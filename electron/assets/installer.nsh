; Volt Custom NSIS Installer Script
; Runs during Windows installation

!macro customInstall
  ; Create registry entry for Volt
  WriteRegStr HKLM "Software\Volt" "InstallPath" "$INSTDIR"
  WriteRegStr HKLM "Software\Volt" "Version" "${VERSION}"
!macroend

!macro customUnInstall
  ; Remove registry entries on uninstall
  DeleteRegKey HKLM "Software\Volt"
!macroend
