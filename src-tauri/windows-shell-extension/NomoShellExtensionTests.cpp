#include <Windows.h>
#include <objbase.h>
#include <shellapi.h>
#include <shobjidl_core.h>
#include <wrl/client.h>

#include <iostream>
#include <string>
#include <vector>

#include "ShellHelpers.h"

using Microsoft::WRL::ComPtr;

namespace {

int g_failures = 0;

void Expect(bool condition, const char* message) {
    if (!condition) {
        std::cerr << "FAILED: " << message << '\n';
        ++g_failures;
    }
}

void TestPathFiltering() {
    Expect(IsMarkdownPath(LR"(C:\docs\readme.md)"), "accepts .md");
    Expect(IsMarkdownPath(LR"(C:\docs\README.MARKDOWN)"), "accepts case-insensitive .markdown");
    Expect(!IsMarkdownPath(LR"(C:\docs\notes.txt)"), "rejects .txt");
    Expect(!IsMarkdownPath(LR"(C:\docs.md\file)"), "rejects extension in parent folder");
}

void TestSelectionFiltering() {
    Expect(IsNomoSelectionSupported(
               NomoCommandKind::Markdown,
               {{LR"(C:\docs\one.md)", false}, {LR"(D:\two.markdown)", false}}),
           "accepts multiple Markdown files");
    Expect(!IsNomoSelectionSupported(
               NomoCommandKind::Markdown,
               {{LR"(C:\docs\one.md)", false}, {LR"(C:\docs\notes.txt)", false}}),
           "rejects mixed Markdown and non-Markdown files");
    Expect(!IsNomoSelectionSupported(
               NomoCommandKind::Markdown,
               {{LR"(C:\docs\one.md)", false}, {LR"(C:\docs\folder)", true}}),
           "rejects mixed file and folder selections");
    Expect(IsNomoSelectionSupported(
               NomoCommandKind::Folder, {{LR"(C:\docs\folder)", true}}),
           "accepts one folder");
    Expect(!IsNomoSelectionSupported(
               NomoCommandKind::Folder,
               {{LR"(C:\docs\one)", true}, {LR"(C:\docs\two)", true}}),
           "rejects multiple folders");
    Expect(IsNomoSelectionSupported(NomoCommandKind::Folder, {}),
           "accepts folder background with no selected item");
    Expect(!IsNomoSelectionSupported(NomoCommandKind::Markdown, {}),
           "rejects an empty Markdown selection");
}

void TestCommandLineQuoting() {
    Expect(QuoteCommandLineArgument(LR"(C:\docs\readme.md)") == LR"(C:\docs\readme.md)",
           "does not quote simple path");
    Expect(QuoteCommandLineArgument(LR"(C:\My Docs\readme.md)") ==
               LR"("C:\My Docs\readme.md")",
           "quotes whitespace");
    Expect(QuoteCommandLineArgument(L"").compare(L"\"\"") == 0, "quotes empty argument");

    const std::vector<std::wstring> paths{
        LR"(C:\My Docs\测试 one.md)", LR"(D:\two.markdown)"};
    const std::wstring arguments = BuildActivationArguments(paths);
    Expect(arguments.find(L"--nomo-shell-open") == 0, "adds activation marker");
    Expect(arguments.find(LR"("C:\My Docs\测试 one.md")") != std::wstring::npos,
           "quotes selected path");

    int argumentCount = 0;
    LPWSTR* parsed = CommandLineToArgvW(arguments.c_str(), &argumentCount);
    Expect(parsed != nullptr, "parses activation arguments with Windows rules");
    if (parsed != nullptr) {
        Expect(argumentCount == 3, "preserves the marker and both paths");
        if (argumentCount == 3) {
            Expect(std::wstring(parsed[0]) == L"--nomo-shell-open", "preserves marker");
            Expect(std::wstring(parsed[1]) == paths[0], "round-trips Unicode spaced path");
            Expect(std::wstring(parsed[2]) == paths[1], "round-trips unquoted path");
        }
        LocalFree(parsed);
    }
}

void TestLocalization() {
    Expect(ResolveNomoLocale(L"zh-CN") == NomoLocale::SimplifiedChinese,
           "resolves Simplified Chinese");
    Expect(ResolveNomoLocale(L"zh-Hant-HK") == NomoLocale::TraditionalChinese,
           "resolves Traditional Chinese");
    Expect(ResolveNomoLocale(L"ja-JP") == NomoLocale::Japanese, "resolves Japanese");
    Expect(ResolveNomoLocale(L"fr-FR") == NomoLocale::English, "falls back to English");
    Expect(std::wstring(GetNomoCommandTitle(
               NomoCommandKind::Folder, NomoLocale::SimplifiedChinese)) ==
               L"在 Nomo 中打开文件夹",
           "returns localized folder title");
}

void TestDisabledMarker() {
    wchar_t temporaryDirectory[MAX_PATH]{};
    Expect(GetTempPathW(MAX_PATH, temporaryDirectory) > 0, "gets temporary directory");
    const std::wstring marker = std::wstring(temporaryDirectory) +
                                L"nomo-shell-test-" +
                                std::to_wstring(GetCurrentProcessId()) + L".disabled";
    DeleteFileW(marker.c_str());
    Expect(!IsContextMenuDisabledAtPath(marker), "missing marker enables menu");

    HANDLE file = CreateFileW(
        marker.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    Expect(file != INVALID_HANDLE_VALUE, "creates disabled marker");
    if (file != INVALID_HANDLE_VALUE) {
        CloseHandle(file);
    }
    Expect(IsContextMenuDisabledAtPath(marker), "existing marker disables menu");
    DeleteFileW(marker.c_str());
}

void TestComFactory() {
    using GetClassObject = HRESULT(STDAPICALLTYPE*)(REFCLSID, REFIID, void**);
    using CanUnloadNow = HRESULT(STDAPICALLTYPE*)();

    HMODULE module = LoadLibraryW(L"NomoShellExtension.dll");
    Expect(module != nullptr, "loads shell extension DLL");
    if (module == nullptr) {
        return;
    }

    const auto getClassObject = reinterpret_cast<GetClassObject>(
        GetProcAddress(module, "DllGetClassObject"));
    const auto canUnloadNow = reinterpret_cast<CanUnloadNow>(
        GetProcAddress(module, "DllCanUnloadNow"));
    Expect(getClassObject != nullptr, "exports DllGetClassObject");
    Expect(canUnloadNow != nullptr, "exports DllCanUnloadNow");

    if (getClassObject != nullptr && canUnloadNow != nullptr) {
        ComPtr<IClassFactory> factory;
        HRESULT result = getClassObject(
            CLSID_NomoMarkdownCommand, IID_PPV_ARGS(&factory));
        Expect(SUCCEEDED(result), "creates Markdown class factory");

        ComPtr<IExplorerCommand> command;
        if (SUCCEEDED(result)) {
            result = factory->CreateInstance(nullptr, IID_PPV_ARGS(&command));
            Expect(SUCCEEDED(result), "creates IExplorerCommand instance");
        }

        PWSTR title = nullptr;
        if (command != nullptr) {
            result = command->GetTitle(nullptr, &title);
            Expect(SUCCEEDED(result) && title != nullptr, "returns command title");
            CoTaskMemFree(title);
        }
        command.Reset();
        factory.Reset();
        Expect(canUnloadNow() == S_OK, "releases COM factory and command");
    }

    FreeLibrary(module);
}

}  // namespace

int wmain() {
    TestPathFiltering();
    TestSelectionFiltering();
    TestCommandLineQuoting();
    TestLocalization();
    TestDisabledMarker();
    TestComFactory();

    if (g_failures == 0) {
        std::wcout << L"NomoShellExtensionTests: all checks passed\n";
        return 0;
    }
    std::cerr << "NomoShellExtensionTests: " << g_failures << " failure(s)\n";
    return 1;
}
