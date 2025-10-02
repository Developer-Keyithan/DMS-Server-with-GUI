!include "MUI2.nsh"
!include "FileFunc.nsh"

; Basic installer settings
Name "Hexabase"
OutFile "dist/Hexabase-Setup-${VERSION}.exe"
InstallDir "$PROGRAMFILES\Hexabase"
InstallDirRegKey HKLM "Software\Hexabase" "Install_Dir"
RequestExecutionLevel admin

; Interface settings
!define MUI_ABORTWARNING
!define MUI_ICON "resources\icon.ico"
!define MUI_UNICON "resources\icon.ico"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Languages
!insertmacro MUI_LANGUAGE "English"

; Installer sections
Section "Hexabase Core" SecCore
    SectionIn RO
    
    SetOutPath "$INSTDIR"
    File /r "hexabase\*"
    
    ; Write installation info
    WriteRegStr HKLM "Software\Hexabase" "Install_Dir" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Hexabase" "DisplayName" "Hexabase"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Hexabase" "UninstallString" '"$INSTDIR\uninstall.exe"'
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Hexabase" "DisplayVersion" "${VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Hexabase" "Publisher" "Hexabase Team"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Hexabase" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Hexabase" "NoRepair" 1
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

Section "Start Menu Shortcuts" SecStartMenu
    CreateDirectory "$SMPROGRAMS\Hexabase"
    CreateShortcut "$SMPROGRAMS\Hexabase\Hexabase.lnk" "$INSTDIR\bin\hexabase.js" "" "$INSTDIR\resources\icon.ico"
    CreateShortcut "$SMPROGRAMS\Hexabase\Uninstall.lnk" "$INSTDIR\uninstall.exe"
SectionEnd

Section "Desktop Shortcut" SecDesktop
    CreateShortcut "$DESKTOP\Hexabase.lnk" "$INSTDIR\bin\hexabase.js" "" "$INSTDIR\resources\icon.ico"
SectionEnd

Section "Add to PATH" SecPath
    EnVar::SetHKCU
    EnVar::AddValue "PATH" "$INSTDIR\bin"
SectionEnd

; Uninstaller
Section "Uninstall"
    ; Remove registry keys
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Hexabase"
    DeleteRegKey HKLM "Software\Hexabase"

    ; Remove files and directories
    RMDir /r "$INSTDIR"

    ; Remove shortcuts
    Delete "$SMPROGRAMS\Hexabase\*.*"
    RMDir "$SMPROGRAMS\Hexabase"
    Delete "$DESKTOP\Hexabase.lnk"

    ; Remove from PATH
    EnVar::SetHKCU
    EnVar::DeleteValue "PATH" "$INSTDIR\bin"
SectionEnd

; Section descriptions
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecCore} "Hexabase core files and components"
    !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} "Create Start Menu shortcuts"
    !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} "Create desktop shortcut"
    !insertmacro MUI_DESCRIPTION_TEXT ${SecPath} "Add Hexabase to system PATH"
!insertmacro MUI_FUNCTION_DESCRIPTION_END