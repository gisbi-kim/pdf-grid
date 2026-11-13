; Exact application-owned filenames from the supplied 1.1.0 and 1.3.3 payloads.
; Never recursively remove directories or use file-extension wildcards.
${If} ${FileExists} "$INSTDIR\LICENSE.electron.txt"
 ClearErrors
 Delete "$INSTDIR\LICENSE.electron.txt"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\LICENSES.chromium.html"
 ClearErrors
 Delete "$INSTDIR\LICENSES.chromium.html"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\PDF Grid.exe"
 ClearErrors
 Delete "$INSTDIR\PDF Grid.exe"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\PDF-Grid.exe"
 ClearErrors
 Delete "$INSTDIR\PDF-Grid.exe"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\Uninstall PDF Grid.exe"
 ClearErrors
 Delete "$INSTDIR\Uninstall PDF Grid.exe"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\Uninstall.exe"
 ClearErrors
 Delete "$INSTDIR\Uninstall.exe"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\chrome_100_percent.pak"
 ClearErrors
 Delete "$INSTDIR\chrome_100_percent.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\chrome_200_percent.pak"
 ClearErrors
 Delete "$INSTDIR\chrome_200_percent.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\d3dcompiler_47.dll"
 ClearErrors
 Delete "$INSTDIR\d3dcompiler_47.dll"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\dxcompiler.dll"
 ClearErrors
 Delete "$INSTDIR\dxcompiler.dll"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\dxil.dll"
 ClearErrors
 Delete "$INSTDIR\dxil.dll"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\ffmpeg.dll"
 ClearErrors
 Delete "$INSTDIR\ffmpeg.dll"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\icudtl.dat"
 ClearErrors
 Delete "$INSTDIR\icudtl.dat"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\libEGL.dll"
 ClearErrors
 Delete "$INSTDIR\libEGL.dll"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\libGLESv2.dll"
 ClearErrors
 Delete "$INSTDIR\libGLESv2.dll"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\af.pak"
 ClearErrors
 Delete "$INSTDIR\locales\af.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\am.pak"
 ClearErrors
 Delete "$INSTDIR\locales\am.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\ar.pak"
 ClearErrors
 Delete "$INSTDIR\locales\ar.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\bg.pak"
 ClearErrors
 Delete "$INSTDIR\locales\bg.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\bn.pak"
 ClearErrors
 Delete "$INSTDIR\locales\bn.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\ca.pak"
 ClearErrors
 Delete "$INSTDIR\locales\ca.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\cs.pak"
 ClearErrors
 Delete "$INSTDIR\locales\cs.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\da.pak"
 ClearErrors
 Delete "$INSTDIR\locales\da.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\de.pak"
 ClearErrors
 Delete "$INSTDIR\locales\de.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\el.pak"
 ClearErrors
 Delete "$INSTDIR\locales\el.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\en-GB.pak"
 ClearErrors
 Delete "$INSTDIR\locales\en-GB.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\en-US.pak"
 ClearErrors
 Delete "$INSTDIR\locales\en-US.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\es-419.pak"
 ClearErrors
 Delete "$INSTDIR\locales\es-419.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\es.pak"
 ClearErrors
 Delete "$INSTDIR\locales\es.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\et.pak"
 ClearErrors
 Delete "$INSTDIR\locales\et.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\fa.pak"
 ClearErrors
 Delete "$INSTDIR\locales\fa.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\fi.pak"
 ClearErrors
 Delete "$INSTDIR\locales\fi.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\fil.pak"
 ClearErrors
 Delete "$INSTDIR\locales\fil.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\fr.pak"
 ClearErrors
 Delete "$INSTDIR\locales\fr.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\gu.pak"
 ClearErrors
 Delete "$INSTDIR\locales\gu.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\he.pak"
 ClearErrors
 Delete "$INSTDIR\locales\he.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\hi.pak"
 ClearErrors
 Delete "$INSTDIR\locales\hi.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\hr.pak"
 ClearErrors
 Delete "$INSTDIR\locales\hr.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\hu.pak"
 ClearErrors
 Delete "$INSTDIR\locales\hu.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\id.pak"
 ClearErrors
 Delete "$INSTDIR\locales\id.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\it.pak"
 ClearErrors
 Delete "$INSTDIR\locales\it.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\ja.pak"
 ClearErrors
 Delete "$INSTDIR\locales\ja.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\kn.pak"
 ClearErrors
 Delete "$INSTDIR\locales\kn.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\ko.pak"
 ClearErrors
 Delete "$INSTDIR\locales\ko.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\lt.pak"
 ClearErrors
 Delete "$INSTDIR\locales\lt.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\lv.pak"
 ClearErrors
 Delete "$INSTDIR\locales\lv.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\ml.pak"
 ClearErrors
 Delete "$INSTDIR\locales\ml.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\mr.pak"
 ClearErrors
 Delete "$INSTDIR\locales\mr.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\ms.pak"
 ClearErrors
 Delete "$INSTDIR\locales\ms.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\nb.pak"
 ClearErrors
 Delete "$INSTDIR\locales\nb.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\nl.pak"
 ClearErrors
 Delete "$INSTDIR\locales\nl.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\pl.pak"
 ClearErrors
 Delete "$INSTDIR\locales\pl.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\pt-BR.pak"
 ClearErrors
 Delete "$INSTDIR\locales\pt-BR.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\pt-PT.pak"
 ClearErrors
 Delete "$INSTDIR\locales\pt-PT.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\ro.pak"
 ClearErrors
 Delete "$INSTDIR\locales\ro.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\ru.pak"
 ClearErrors
 Delete "$INSTDIR\locales\ru.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\sk.pak"
 ClearErrors
 Delete "$INSTDIR\locales\sk.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\sl.pak"
 ClearErrors
 Delete "$INSTDIR\locales\sl.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\sr.pak"
 ClearErrors
 Delete "$INSTDIR\locales\sr.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\sv.pak"
 ClearErrors
 Delete "$INSTDIR\locales\sv.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\sw.pak"
 ClearErrors
 Delete "$INSTDIR\locales\sw.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\ta.pak"
 ClearErrors
 Delete "$INSTDIR\locales\ta.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\te.pak"
 ClearErrors
 Delete "$INSTDIR\locales\te.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\th.pak"
 ClearErrors
 Delete "$INSTDIR\locales\th.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\tr.pak"
 ClearErrors
 Delete "$INSTDIR\locales\tr.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\uk.pak"
 ClearErrors
 Delete "$INSTDIR\locales\uk.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\ur.pak"
 ClearErrors
 Delete "$INSTDIR\locales\ur.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\vi.pak"
 ClearErrors
 Delete "$INSTDIR\locales\vi.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\zh-CN.pak"
 ClearErrors
 Delete "$INSTDIR\locales\zh-CN.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\locales\zh-TW.pak"
 ClearErrors
 Delete "$INSTDIR\locales\zh-TW.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\resources.pak"
 ClearErrors
 Delete "$INSTDIR\resources.pak"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\resources\app.asar"
 ClearErrors
 Delete "$INSTDIR\resources\app.asar"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\resources\default_app.asar"
 ClearErrors
 Delete "$INSTDIR\resources\default_app.asar"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\resources\elevate.exe"
 ClearErrors
 Delete "$INSTDIR\resources\elevate.exe"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\snapshot_blob.bin"
 ClearErrors
 Delete "$INSTDIR\snapshot_blob.bin"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\uninstallerIcon.ico"
 ClearErrors
 Delete "$INSTDIR\uninstallerIcon.ico"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\v8_context_snapshot.bin"
 ClearErrors
 Delete "$INSTDIR\v8_context_snapshot.bin"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\version"
 ClearErrors
 Delete "$INSTDIR\version"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\vk_swiftshader.dll"
 ClearErrors
 Delete "$INSTDIR\vk_swiftshader.dll"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\vk_swiftshader_icd.json"
 ClearErrors
 Delete "$INSTDIR\vk_swiftshader_icd.json"
 IfErrors cleanupFailed
${EndIf}
${If} ${FileExists} "$INSTDIR\vulkan-1.dll"
 ClearErrors
 Delete "$INSTDIR\vulkan-1.dll"
 IfErrors cleanupFailed
${EndIf}
