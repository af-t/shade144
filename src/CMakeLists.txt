cmake_minimum_required(VERSION 3.10)
project(shade144_whitelist)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Honor LDFLAGS from the environment at link time:
#   LDFLAGS="-s -Wl,--gc-sections" cmake -S src -B build -DCMAKE_BUILD_TYPE=Release
if(DEFINED ENV{LDFLAGS})
  string(APPEND CMAKE_EXE_LINKER_FLAGS " $ENV{LDFLAGS}")
endif()

# Strip release binaries via linker -s. Disable with -DSHADE144_STRIP=OFF.
# (Alternative: cmake --install build --strip, or add -s to LDFLAGS above.)
option(SHADE144_STRIP "Link Release builds with -s (strip symbols)" ON)
if(SHADE144_STRIP)
  string(APPEND CMAKE_EXE_LINKER_FLAGS_RELEASE " -s")
endif()

add_executable(whitelist_updater
    whitelist.cpp
    main.cpp
)

# For Android cross-compile: cmake -DCMAKE_TOOLCHAIN_FILE=$NDK/build/cmake/android.toolchain.cmake -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=android-24 ..
# No external deps - pure stdlib

enable_testing()
add_executable(whitelist_test
    whitelist.cpp
    test_whitelist.cpp
)
add_test(NAME whitelist_test COMMAND whitelist_test)
