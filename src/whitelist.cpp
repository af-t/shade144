#include "whitelist.h"

#include <algorithm>
#include <cctype>
#include <sstream>

static inline std::string trim(const std::string& s) {
    size_t a = 0;
    while (a < s.size() && std::isspace((unsigned char)s[a])) ++a;
    size_t b = s.size();
    while (b > a && std::isspace((unsigned char)s[b - 1])) --b;
    return s.substr(a, b - a);
}

bool isValidPackage(const std::string& pkg) {
    std::string s = trim(pkg);
    if (s.empty()) return false;
    if (s.find('.') == std::string::npos) return false;
    // simple validation: each segment starts with letter, rest alnum or _
    size_t start = 0;
    for (size_t i = 0; i <= s.size(); ++i) {
        if (i == s.size() || s[i] == '.') {
            size_t len = i - start;
            if (len == 0) return false;
            if (!std::isalpha((unsigned char)s[start])) return false;
            for (size_t j = start + 1; j < i; ++j) {
                char c = s[j];
                if (!std::isalnum((unsigned char)c) && c != '_') return false;
            }
            start = i + 1;
        }
    }
    return true;
}

std::set<std::string> extractExistingPackages(const std::string& xml) {
    std::set<std::string> out;
    const std::string key = "package=\"";
    size_t pos = 0;
    while (true) {
        pos = xml.find(key, pos);
        if (pos == std::string::npos) break;
        size_t start = pos + key.size();
        size_t end = xml.find('"', start);
        if (end == std::string::npos) break;
        std::string pkg = xml.substr(start, end - start);
        if (!pkg.empty()) out.insert(pkg);
        pos = end + 1;
    }
    return out;
}

std::string buildItemLine(const std::string& pkg, const WhitelistDefaults& d) {
    std::ostringstream oss;
    oss << "        <item package=\"" << pkg
        << "\" auto=\"" << d.auto_rate
        << "\" high=\"" << d.high
        << "\" max=\"" << d.max
        << "\" touch=\"" << d.touch
        << "\" app_request=\"" << d.app_request
        << "\"></item>";
    return oss.str();
}

UpdateResult updateWhitelist(const std::string& xml,
                             const std::vector<std::string>& installed,
                             const WhitelistDefaults& defaults) {
    UpdateResult res;

    auto existing = extractExistingPackages(xml);
    res.existing_unique = existing.size();

    // count total <item occurrences> for info
    size_t total = 0;
    size_t p = 0;
    while ((p = xml.find("<item", p)) != std::string::npos) { ++total; ++p; }
    res.total_items = total;

    std::set<std::string> seen;
    std::vector<std::string> toAdd;
    for (auto raw : installed) {
        std::string pkg = trim(raw);
        if (pkg.empty()) continue;
        if (seen.count(pkg)) continue;
        seen.insert(pkg);
        if (!isValidPackage(pkg)) continue;
        if (existing.count(pkg) == 0) {
            toAdd.push_back(pkg);
            existing.insert(pkg);
        }
    }
    std::sort(toAdd.begin(), toAdd.end());
    res.added = toAdd;

    if (toAdd.empty()) {
        res.xml = xml;
        return res;
    }

    // Find WHITELIST block case-insensitive? File uses <WHITELIST>
    // Search for </WHITELIST> or case-insensitive fallback
    std::string closeTag = "</WHITELIST>";
    size_t closePos = xml.find(closeTag);
    std::string closeTagLower = "</whitelist>";
    if (closePos == std::string::npos) closePos = xml.find(closeTagLower);
    // also try uppercase/lower variations
    if (closePos == std::string::npos) {
        std::string lower = xml;
        std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
        size_t lp = lower.find("</whitelist>");
        if (lp != std::string::npos) closePos = lp;
    }
    if (closePos == std::string::npos) {
        res.xml = xml;
        return res;
    }

    std::string prefix = xml.substr(0, closePos);
    std::string suffix = xml.substr(closePos);

    std::ostringstream ins;
    for (auto &pkg : toAdd) {
        ins << buildItemLine(pkg, defaults) << "\n";
    }
    // Ensure prefix ends with newline
    if (!prefix.empty() && prefix.back() != '\n') prefix += "\n";

    res.xml = prefix + ins.str() + suffix;
    res.total_items = total + toAdd.size();
    return res;
}
