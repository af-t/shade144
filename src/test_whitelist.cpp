#include "whitelist.h"
#include <cassert>
#include <iostream>
#include <fstream>
#include <sstream>
#include <stdexcept>

static std::string readFile(const std::string& p) {
    std::ifstream f(p);
    if (!f) throw std::runtime_error("cannot open: " + p);
    std::ostringstream ss; ss << f.rdbuf(); return ss.str();
}

int main() {
    // Resolve XML relative to cwd: repo root, src/ (make test), or build/ (ctest).
    static const char* candidates[] = {
        "system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml",
        "../system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml",
    };
    std::string xml;
    for (const char* c : candidates) {
        try { xml = readFile(c); break; }
        catch (const std::exception&) {}
    }
    if (xml.empty()) {
        std::cerr << "failed to load refresh_rate_config.xml\n";
        return 1;
    }

    // test defaults exact
    WhitelistDefaults d;
    assert(d.auto_rate == "90");
    assert(d.high == "90");
    assert(d.max == "144");
    assert(d.app_request == "0");
    std::cout << "PASS defaults\n";

    // test no duplicate
    {
        auto r = updateWhitelist(xml, {"com.android.settings", "com.android.settings"});
        assert(r.added.empty());
        std::cout << "PASS no duplicate\n";
    }
    // test adds missing
    {
        auto r = updateWhitelist(xml, {"com.example.alpha", "com.example.beta"});
        assert(r.added.size() == 2);
        assert(r.xml.find("package=\"com.example.alpha\"") != std::string::npos);
        assert(r.xml.find("auto=\"90\"") != std::string::npos);
        assert(r.xml.find("high=\"90\"") != std::string::npos);
        assert(r.xml.find("max=\"144\"") != std::string::npos);
        assert(r.xml.find("app_request=\"0\"") != std::string::npos);
        std::cout << "PASS adds missing\n";
    }
    // test sorted
    {
        auto r = updateWhitelist(xml, {"com.zulu.app", "com.alpha.app", "com.middle.app"});
        size_t a = r.xml.find("com.alpha.app");
        size_t m = r.xml.find("com.middle.app");
        size_t z = r.xml.find("com.zulu.app");
        assert(a < m && m < z);
        std::cout << "PASS sorted\n";
    }
    // test invalid skipped
    {
        auto r = updateWhitelist(xml, {"invalidpackage", "", "com.valid.app"});
        assert(r.added.size() == 1 && r.added[0] == "com.valid.app");
        std::cout << "PASS invalid skipped\n";
    }
    // test preserve existing
    {
        auto r = updateWhitelist(xml, {"com.new.app123"});
        assert(r.xml.find("com.android.settings") != std::string::npos);
        assert(r.xml.find("org.mozilla.firefox") != std::string::npos);
        assert(r.xml.find("<switch>") != std::string::npos);
        std::cout << "PASS preserve\n";
    }
    // test buildItemLine
    {
        std::string line = buildItemLine("com.test.app", d);
        assert(line == "        <item package=\"com.test.app\" auto=\"90\" high=\"90\" max=\"144\" touch=\"1\" app_request=\"0\"></item>");
        std::cout << "PASS buildItemLine\n";
    }

    std::cout << "All C++ tests PASS\n";
    return 0;
}
