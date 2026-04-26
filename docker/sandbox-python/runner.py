import sys
import json
import signal

# Hard timeout: 3 seconds
def timeout_handler(signum, frame):
    raise TimeoutError("Code execution timed out")

signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(3)

calls = []

def attack(t='jab'):
    calls.append({'action': 'attack', 'type': t})

def laser(p=80):
    calls.append({'action': 'laser', 'power': p})

def shield(d=1):
    calls.append({'action': 'shield', 'dur': d})

def dodge(d='left'):
    calls.append({'action': 'dodge', 'dir': d})

def combo(moves=None):
    calls.append({'action': 'combo', 'moves': moves or []})

def repair(a=20):
    calls.append({'action': 'repair', 'amt': a})

def move_forward(n=1):
    calls.append({'action': 'moveForward', 'n': n})

def move_backward(n=1):
    calls.append({'action': 'moveBackward', 'n': n})


class Enemy:
    def __init__(self, hp, last_action='attack', shield_active=False):
        self.hp = hp
        self.last_action = last_action
        self.shield_active = shield_active
        self.cooldowns = {'laser': 0, 'combo': 0, 'repair': 0}


player_code = sys.stdin.read()

safe_globals = {
    'attack': attack,
    'laser': laser,
    'shield': shield,
    'dodge': dodge,
    'combo': combo,
    'repair': repair,
    'move_forward': move_forward,
    'move_backward': move_backward,
    '__builtins__': {
        'range': range, 'len': len, 'abs': abs,
        'min': min, 'max': max, 'print': print,
        'True': True, 'False': False, 'None': None,
        'int': int, 'float': float, 'str': str, 'bool': bool,
    },
}

try:
    exec(player_code, safe_globals)

    # Test 1: normal HP
    fn = safe_globals.get('on_round_start') or safe_globals.get('onRoundStart')
    if fn:
        fn(Enemy(hp=60))

    # Test 2: low HP
    calls_before = len(calls)
    if fn:
        fn(Enemy(hp=20))

    print(json.dumps({'ok': True, 'calls': calls}))
except Exception as e:
    print(json.dumps({'ok': False, 'error': str(e)}))
