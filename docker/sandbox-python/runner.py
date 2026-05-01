"""
RoboCode Python sandbox runner — interactive stdio protocol.

Protocol (all messages are newline-delimited JSON):
  Node → Python: {"type":"init","code":"<user code>"}
  Python → Node: {"type":"calls","calls":[...]}   # static strategy extraction
  Python → Node: {"type":"ready"}
  Node → Python: {"type":"turn","ctx":{...}}       # per battle turn
  Python → Node: {"type":"action","action":"..."}  # response

On any fatal error Python outputs {"type":"error","message":"..."} and exits.
"""
import sys
import json
import math
import random
import collections
import itertools

# ── Flush-safe output ────────────────────────────────────────────────────────

def emit(obj):
    sys.stdout.write(json.dumps(obj) + '\n')
    sys.stdout.flush()

# ── Action registry (used for static call extraction) ───────────────────────

VALID_ACTIONS = {'attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special'}

_recorded_calls = []

def _make_action_fn(name):
    def fn(*_args, **_kwargs):
        _recorded_calls.append({'action': name})
    fn.__name__ = name
    return fn

# ── Context object passed to strategy(ctx) ──────────────────────────────────

class Ctx:
    """
    Fields available inside strategy(ctx):
      ctx.my_hp           int   0-100
      ctx.my_stamina      int   0-100
      ctx.my_rage         int   0-100
      ctx.my_position     str   'close'|'mid'|'far'
      ctx.enemy_hp        int
      ctx.enemy_stamina   int
      ctx.enemy_rage      int
      ctx.enemy_position  str
      ctx.cooldowns       dict  {'attack':0,'heavy':0,'laser':0,'shield':0,'dodge':0,'repair':0,'special':0}
      ctx.my_last_action  str|None
      ctx.enemy_last_action str|None
      ctx.my_repeat_count int
      ctx.turn            int   1-20
      ctx.distance_modifier float  e.g. 1.3 at close with attack
    """
    __slots__ = (
        'my_hp', 'my_stamina', 'my_rage', 'my_position',
        'enemy_hp', 'enemy_stamina', 'enemy_rage', 'enemy_position',
        'cooldowns', 'my_last_action', 'enemy_last_action',
        'my_repeat_count', 'turn', 'distance_modifier',
    )

    def __init__(self, d):
        self.my_hp             = int(d.get('myHp', 100))
        self.my_stamina        = int(d.get('myStamina', 100))
        self.my_rage           = int(d.get('myRage', 0))
        self.my_position       = str(d.get('myPosition', 'mid'))
        self.enemy_hp          = int(d.get('enemyHp', 100))
        self.enemy_stamina     = int(d.get('enemyStamina', 100))
        self.enemy_rage        = int(d.get('enemyRage', 0))
        self.enemy_position    = str(d.get('enemyPosition', 'mid'))
        raw_cd                 = d.get('cooldowns', {})
        self.cooldowns         = {
            'attack':  int(raw_cd.get('attack', 0)),
            'heavy':   int(raw_cd.get('heavy', 0)),
            'laser':   int(raw_cd.get('laser', 0)),
            'shield':  int(raw_cd.get('shield', 0)),
            'dodge':   int(raw_cd.get('dodge', 0)),
            'repair':  int(raw_cd.get('repair', 0)),
            'special': int(raw_cd.get('special', 0)),
        }
        self.my_last_action    = d.get('myLastAction')
        self.enemy_last_action = d.get('enemyLastAction')
        self.my_repeat_count   = int(d.get('myRepeatCount', 0))
        self.turn              = int(d.get('turn', 1))
        self.distance_modifier = float(d.get('distanceModifier', 1.0))

# ── Safe built-ins ───────────────────────────────────────────────────────────

SAFE_BUILTINS = {
    # types
    'int': int, 'float': float, 'str': str, 'bool': bool,
    'list': list, 'dict': dict, 'tuple': tuple, 'set': set,
    # iteration / functional
    'range': range, 'len': len, 'enumerate': enumerate, 'zip': zip,
    'map': map, 'filter': filter, 'sorted': sorted, 'reversed': reversed,
    'sum': sum, 'min': min, 'max': max, 'abs': abs, 'round': round,
    'any': any, 'all': all,
    # I/O (print goes to stderr so it doesn't pollute the protocol)
    'print': lambda *a, **kw: print(*a, **kw, file=sys.stderr),
    # constants
    'True': True, 'False': False, 'None': None,
    # exceptions
    'Exception': Exception, 'ValueError': ValueError,
    'TypeError': TypeError, 'KeyError': KeyError,
    # stdlib modules (safe subsets)
    'math': math,
    'random': random,
    'collections': collections,
    'itertools': itertools,
}

# ── Test scenarios for static call extraction ────────────────────────────────

TEST_SCENARIOS = [
    # (label, ctx_dict)
    ('normal', {
        'myHp': 80, 'myStamina': 80, 'myRage': 0,
        'myPosition': 'mid',
        'enemyHp': 70, 'enemyStamina': 80, 'enemyRage': 0,
        'enemyPosition': 'mid',
        'cooldowns': {k: 0 for k in ('attack','heavy','laser','shield','dodge','repair','special')},
        'myLastAction': None, 'enemyLastAction': None,
        'myRepeatCount': 0, 'turn': 1, 'distanceModifier': 1.0,
    }),
    ('low_hp', {
        'myHp': 20, 'myStamina': 60, 'myRage': 40,
        'myPosition': 'mid',
        'enemyHp': 80, 'enemyStamina': 80, 'enemyRage': 20,
        'enemyPosition': 'mid',
        'cooldowns': {k: 0 for k in ('attack','heavy','laser','shield','dodge','repair','special')},
        'myLastAction': 'attack', 'enemyLastAction': 'laser',
        'myRepeatCount': 1, 'turn': 10, 'distanceModifier': 1.0,
    }),
    ('rage_ready', {
        'myHp': 60, 'myStamina': 100, 'myRage': 100,
        'myPosition': 'close',
        'enemyHp': 50, 'enemyStamina': 50, 'enemyRage': 0,
        'enemyPosition': 'close',
        'cooldowns': {k: 0 for k in ('attack','heavy','laser','shield','dodge','repair','special')},
        'myLastAction': 'attack', 'enemyLastAction': 'shield',
        'myRepeatCount': 2, 'turn': 8, 'distanceModifier': 1.3,
    }),
]

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    # Step 1: read init message
    try:
        raw = sys.stdin.readline()
        if not raw:
            emit({'type': 'error', 'message': 'No init message received'})
            sys.exit(1)
        msg = json.loads(raw.strip())
    except Exception as e:
        emit({'type': 'error', 'message': f'Failed to parse init: {e}'})
        sys.exit(1)

    if msg.get('type') != 'init':
        emit({'type': 'error', 'message': f'Expected init, got: {msg.get("type")}'})
        sys.exit(1)

    user_code = msg.get('code', '')

    # Step 2: build sandbox globals and execute user code
    action_fns = {name: _make_action_fn(name) for name in VALID_ACTIONS}

    sandbox = {
        '__builtins__': SAFE_BUILTINS,
        **action_fns,
    }

    try:
        exec(compile(user_code, '<strategy>', 'exec'), sandbox)
    except Exception as e:
        emit({'type': 'error', 'message': f'Compile error: {e}'})
        sys.exit(1)

    strategy_fn = sandbox.get('strategy')
    if not callable(strategy_fn):
        emit({'type': 'error', 'message': 'No callable "strategy" function defined'})
        sys.exit(1)

    # Step 3: run test scenarios to extract static calls
    _recorded_calls.clear()
    # Re-inject recording action functions into sandbox so strategy calls them
    for name, fn in action_fns.items():
        sandbox[name] = fn

    for _label, ctx_dict in TEST_SCENARIOS:
        try:
            result = strategy_fn(Ctx(ctx_dict))
            if isinstance(result, str) and result in VALID_ACTIONS:
                _recorded_calls.append({'action': result})
        except Exception:
            pass  # test failures are non-fatal

    emit({'type': 'calls', 'calls': _recorded_calls})

    # Step 4: signal ready
    emit({'type': 'ready'})

    # Step 5: per-turn loop
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        try:
            msg = json.loads(line)
        except Exception:
            continue

        if msg.get('type') != 'turn':
            continue

        ctx_data = msg.get('ctx', {})
        try:
            ctx = Ctx(ctx_data)
            action = strategy_fn(ctx)
            if not isinstance(action, str) or action not in VALID_ACTIONS:
                action = 'attack'
        except Exception as e:
            sys.stderr.write(f'[runner] strategy error: {e}\n')
            action = 'attack'

        emit({'type': 'action', 'action': action})


if __name__ == '__main__':
    main()
