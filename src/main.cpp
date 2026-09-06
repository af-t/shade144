#include "whitelist.h"

#include <fstream>
#include <iostream>
#include <sstream>
#include <unistd.h>

static std::string readFile(const std::string& path) {
    std::ifstream f(path, std::ios::binary);
    if (!f) throw std::runtime_error("cannot open input: " + path);
    std::ostringstream ss;
    ss << f.rdbuf();
    return ss.str();
}

static void writeFile(const std::string& path, const std::string& data) {
    std::ofstream f(path, std::ios::binary | std::ios::trunc);
    if (!f) throw std::runtime_error("cannot open output: " + path);
    f << data;
}

static std::vector<std::string> splitComma(const std::string& s) {
    std::vector<std::string> out;
    std::stringstream ss(s);
    std::string tok;
    while (std::getline(ss, tok, ',')) {
        // trim
        size_t a = 0;
        while (a < tok.size() && std::isspace((unsigned char)tok[a])) ++a;
        size_t b = tok.size();
        while (b > a && std::isspace((unsigned char)tok[b-1])) --b;
        if (b > a) out.push_back(tok.substr(a, b-a));
    }
    return out;
}

static std::vector<std::string> readPackageFile(const std::string& path) {
    std::ifstream f(path);
    if (!f) throw std::runtime_error("cannot open package file: " + path);
    std::vector<std::string> out;
    std::string line;
    while (std::getline(f, line)) {
        size_t a = 0;
        while (a < line.size() && std::isspace((unsigned char)line[a])) ++a;
        size_t b = line.size();
        while (b > a && std::isspace((unsigned char)line[b-1])) --b;
        if (b > a) {
            std::string pkg = line.substr(a, b-a);
            // handle pm list packages format: "package:com.example.app"
            if (pkg.rfind("package:", 0) == 0) pkg = pkg.substr(8);
            if (!pkg.empty()) out.push_back(pkg);
        }
    }
    return out;
}

static void printUsage(const char* prog) {
    std::cerr << "Usage: " << prog << " [options]\n"
              << "  --input <xml>         input refresh_rate_config.xml (default: system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml)\n"
              << "  --output <xml>        output path (default: overwrite input)\n"
              << "  --packages a,b,c      comma-separated package list\n"
              << "  --file <path>         file with one package per line (or pm list output)\n"
              << "  --auto <n> --high <n> --max <n> --touch <n> --app_request <n>  override defaults\n"
              << "Defaults: auto=90 high=90 max=144 touch=1 app_request=0\n";
}

int main(int argc, char* argv[]) {
    std::string input = "system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml";
    std::string output;
    std::vector<std::string> packages;
    std::string packageFile;
    WhitelistDefaults defaults;

    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        if (a == "--input" && i + 1 < argc) input = argv[++i];
        else if (a == "--output" && i + 1 < argc) output = argv[++i];
        else if (a == "--packages" && i + 1 < argc) {
            auto v = splitComma(argv[++i]);
            packages.insert(packages.end(), v.begin(), v.end());
        } else if (a == "--file" && i + 1 < argc) packageFile = argv[++i];
        else if (a == "--auto" && i + 1 < argc) defaults.auto_rate = argv[++i];
        else if (a == "--high" && i + 1 < argc) defaults.high = argv[++i];
        else if (a == "--max" && i + 1 < argc) defaults.max = argv[++i];
        else if (a == "--touch" && i + 1 < argc) defaults.touch = argv[++i];
        else if (a == "--app_request" && i + 1 < argc) defaults.app_request = argv[++i];
        else if (a == "--help" || a == "-h") { printUsage(argv[0]); return 0; }
        else { std::cerr << "Unknown arg: " << a << "\n"; printUsage(argv[0]); return 1; }
    }

    if (!packageFile.empty()) {
        auto v = readPackageFile(packageFile);
        packages.insert(packages.end(), v.begin(), v.end());
    }

    // if still empty, try read from stdin (for pm list | binary)
    if (packages.empty() && !isatty(STDIN_FILENO)) {
        std::string line;
        while (std::getline(std::cin, line)) {
            size_t a = 0;
            while (a < line.size() && std::isspace((unsigned char)line[a])) ++a;
            size_t b = line.size();
            while (b > a && std::isspace((unsigned char)line[b-1])) --b;
            if (b > a) {
                std::string pkg = line.substr(a, b-a);
                if (pkg.rfind("package:", 0) == 0) pkg = pkg.substr(8);
                packages.push_back(pkg);
            }
        }
    }

    if (packages.empty()) {
        std::cerr << "No packages provided. Use --packages or --file or pipe pm list.\n";
        printUsage(argv[0]);
        return 1;
    }

    std::string xml;
    try { xml = readFile(input); }
    catch (std::exception& e) { std::cerr << e.what() << "\n"; return 2; }

    UpdateResult r = updateWhitelist(xml, packages, defaults);

    std::string outPath = output.empty() ? input : output;
    // backup if overwriting
    if (output.empty()) {
        // create .bak
        try { writeFile(input + ".bak", xml); } catch (...) {}
    }

    try { writeFile(outPath, r.xml); }
    catch (std::exception& e) { std::cerr << e.what() << "\n"; return 3; }

    std::cout << "Existing unique: " << r.existing_unique
              << " Added: " << r.added.size()
              << " Total items: " << r.total_items << "\n";
    for (auto &p : r.added) {
        std::cout << "  + " << p << " auto=" << defaults.auto_rate
                  << " high=" << defaults.high
                  << " max=" << defaults.max
                  << " touch=" << defaults.touch
                  << " app_request=" << defaults.app_request << "\n";
    }
    if (r.added.empty()) std::cout << "No new packages to add.\n";
    std::cout << "Output: " << outPath << "\n";
    return 0;
}
