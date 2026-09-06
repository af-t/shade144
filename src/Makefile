CXX ?= g++
# C++ standard (no -std=c++21 in GCC/Clang; valid: c++20, c++23). Override: make CXXSTD=c++20
CXXSTD ?= c++23
# NB: CXXFLAGS/LDFLAGS may come from the environment (they override ?=),
# so -std= is passed explicitly to guarantee the standard always applies.
WARNFLAGS ?= -Wall -Wextra
CXXFLAGS ?= -O2
LDFLAGS ?=
LDLIBS ?=
STRIP ?= strip

all: whitelist_updater

whitelist_updater: whitelist.cpp whitelist.h main.cpp
	$(CXX) -std=$(CXXSTD) $(WARNFLAGS) $(CXXFLAGS) -o $@ whitelist.cpp main.cpp $(LDFLAGS) $(LDLIBS)

test: whitelist_test
	./whitelist_test

whitelist_test: whitelist.cpp whitelist.h test_whitelist.cpp
	$(CXX) -std=$(CXXSTD) $(WARNFLAGS) $(CXXFLAGS) -o $@ whitelist.cpp test_whitelist.cpp $(LDFLAGS) $(LDLIBS)

# Release build: optimise + link with -s (strip symbols).
# Usage: make release | make CXXSTD=c++20 release | make release LDFLAGS="-s -Wl,--gc-sections"
# Rebuilds from clean so the release flags always apply.
release: CXXFLAGS += -O3 -DNDEBUG
release: LDFLAGS += -s
release: clean whitelist_updater

strip: whitelist_updater whitelist_test
	$(STRIP) whitelist_updater whitelist_test

clean:
	rm -f whitelist_updater whitelist_test

.PHONY: all test release strip clean
