#pragma once

#include <string>
#include <vector>
#include <set>

struct WhitelistDefaults {
    std::string auto_rate = "90";
    std::string high = "90";
    std::string max = "144";
    std::string touch = "1";
    std::string app_request = "0";
};

struct UpdateResult {
    size_t existing_unique = 0;
    size_t total_items = 0;
    std::vector<std::string> added;
    std::string xml;
};

// Validate package name: must contain dot, start with letter, segments [A-Za-z][A-Za-z0-9_]*
bool isValidPackage(const std::string& pkg);

std::set<std::string> extractExistingPackages(const std::string& xml);

UpdateResult updateWhitelist(const std::string& xml,
                             const std::vector<std::string>& installed,
                             const WhitelistDefaults& defaults = WhitelistDefaults{});

std::string buildItemLine(const std::string& pkg, const WhitelistDefaults& d);
