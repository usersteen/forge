@echo off
if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" (
    call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" x64
) else if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" (
    call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64
) else (
    echo ERROR: Could not find vcvarsall.bat. Install Visual Studio or Build Tools.
    exit /b 1
)
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
cd /d "%~dp0"
node scripts\tauri.cjs dev
