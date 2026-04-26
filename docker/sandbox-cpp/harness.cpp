#include <iostream>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>
using json = nlohmann::json;

json calls = json::array();

struct Action {
    std::string name;
    int power = 0;
    std::string dir;
    std::string type;
};

Action attack(std::string t = "jab") {
    calls.push_back({{"action","attack"},{"type",t}});
    return {t};
}
Action laser(int p = 80) {
    calls.push_back({{"action","laser"},{"power",p}});
    return {"laser", p};
}
Action shield(int d = 1) {
    calls.push_back({{"action","shield"},{"dur",d}});
    return {"shield"};
}
Action dodge(std::string d = "left") {
    calls.push_back({{"action","dodge"},{"dir",d}});
    return {"dodge"};
}
Action combo() {
    calls.push_back({{"action","combo"}});
    return {"combo"};
}
Action repair(int a = 20) {
    calls.push_back({{"action","repair"},{"amt",a}});
    return {"repair"};
}
Action moveForward(int n = 1) {
    calls.push_back({{"action","moveForward"},{"n",n}});
    return {"moveForward"};
}
Action moveBackward(int n = 1) {
    calls.push_back({{"action","moveBackward"},{"n",n}});
    return {"moveBackward"};
}

struct Cooldowns { int laser=0, combo=0, repair=0; };
struct Enemy {
    int hp;
    std::string lastAction;
    bool shieldActive;
    Cooldowns cooldowns;
};

// ── USER CODE INSERTED BELOW ──
//USER_CODE_PLACEHOLDER//
// ── END USER CODE ────────────

int main() {
    try {
        Enemy e1{60, "attack", false, {0,0,0}};
        Enemy e2{20, "laser",  false, {0,0,0}};
        onRoundStart(e1);
        onRoundStart(e2);
        std::cout << calls.dump() << std::endl;
        return 0;
    } catch (...) {
        std::cout << "[]" << std::endl;
        return 0;
    }
}
