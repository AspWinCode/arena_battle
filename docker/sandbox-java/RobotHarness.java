import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;

public class RobotHarness {
    static List<Map<String,Object>> calls = new ArrayList<>();

    static Object attack(String t)  { calls.add(Map.of("action","attack","type",t));   return null; }
    static Object attack()          { return attack("hook"); }
    static Object laser(int p)      { calls.add(Map.of("action","laser","power",p));    return null; }
    static Object laser()           { return laser(80); }
    static Object shield(int d)     { calls.add(Map.of("action","shield","dur",d));     return null; }
    static Object shield()          { return shield(1); }
    static Object dodge(String d)   { calls.add(Map.of("action","dodge","dir",d));      return null; }
    static Object dodge()           { return dodge("left"); }
    static Object combo(Object...a) { calls.add(Map.of("action","combo"));               return null; }
    static Object repair(int a)     { calls.add(Map.of("action","repair","amt",a));     return null; }
    static Object repair()          { return repair(20); }
    static Object moveForward(int n){ calls.add(Map.of("action","moveForward","n",n));  return null; }
    static Object moveBackward(int n){ calls.add(Map.of("action","moveBackward","n",n)); return null; }

    static class Cooldowns {
        public int laser = 0, combo = 0, repair = 0;
    }
    static class Enemy {
        public int hp;
        public String lastAction;
        public boolean shieldActive;
        public Cooldowns cooldowns = new Cooldowns();
        public Enemy(int hp, String lastAction, boolean shieldActive) {
            this.hp = hp;
            this.lastAction = lastAction;
            this.shieldActive = shieldActive;
        }
    }

    //USER_CODE_PLACEHOLDER//

    public static void main(String[] args) throws Exception {
        try {
            var e1 = new Enemy(60, "attack", false);
            var e2 = new Enemy(20, "laser",  false);
            onRoundStart(e1);
            onRoundStart(e2);
            ObjectMapper om = new ObjectMapper();
            System.out.println(om.writeValueAsString(Map.of("ok", true, "calls", calls)));
        } catch (Exception e) {
            System.out.println("{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}
