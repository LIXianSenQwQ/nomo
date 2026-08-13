#include <Windows.h>
#include <appmodel.h>
#include <objbase.h>
#include <shlobj.h>
#include <shobjidl_core.h>
#include <wrl/client.h>

#include <new>
#include <string>
#include <vector>

#include "ShellHelpers.h"

using Microsoft::WRL::ComPtr;

namespace {

HINSTANCE g_module = nullptr;
volatile long g_liveObjects = 0;

HRESULT CopyStringToCoTaskMem(const std::wstring& value, PWSTR* output) noexcept {
    if (output == nullptr) {
        return E_POINTER;
    }
    *output = nullptr;
    const std::size_t bytes = (value.size() + 1) * sizeof(wchar_t);
    auto* copy = static_cast<PWSTR>(CoTaskMemAlloc(bytes));
    if (copy == nullptr) {
        return E_OUTOFMEMORY;
    }
    memcpy(copy, value.c_str(), bytes);
    *output = copy;
    return S_OK;
}

NomoLocale CurrentNomoLocale() noexcept {
    wchar_t localeName[LOCALE_NAME_MAX_LENGTH]{};
    const LANGID language = GetUserDefaultUILanguage();
    const LCID locale = MAKELCID(language, SORT_DEFAULT);
    if (LCIDToLocaleName(locale, localeName, LOCALE_NAME_MAX_LENGTH, 0) > 0) {
        return ResolveNomoLocale(localeName);
    }
    return NomoLocale::English;
}

HRESULT CurrentModulePath(std::wstring* path) {
    if (path == nullptr) {
        return E_POINTER;
    }
    std::vector<wchar_t> buffer(MAX_PATH);
    while (true) {
        const DWORD length = GetModuleFileNameW(
            g_module, buffer.data(), static_cast<DWORD>(buffer.size()));
        if (length == 0) {
            return HRESULT_FROM_WIN32(GetLastError());
        }
        if (length < buffer.size() - 1) {
            path->assign(buffer.data(), length);
            return S_OK;
        }
        if (buffer.size() >= 32'768) {
            return HRESULT_FROM_WIN32(ERROR_INSUFFICIENT_BUFFER);
        }
        buffer.resize(buffer.size() * 2);
    }
}

HRESULT CurrentPackageFamilyName(std::wstring* packageFamilyName) {
    if (packageFamilyName == nullptr) {
        return E_POINTER;
    }
    UINT32 length = 0;
    LONG result = GetCurrentPackageFamilyName(&length, nullptr);
    if (result == APPMODEL_ERROR_NO_PACKAGE) {
        return HRESULT_FROM_WIN32(APPMODEL_ERROR_NO_PACKAGE);
    }
    if (result != ERROR_INSUFFICIENT_BUFFER || length == 0) {
        return HRESULT_FROM_WIN32(result);
    }

    std::vector<wchar_t> buffer(length);
    result = GetCurrentPackageFamilyName(&length, buffer.data());
    if (result != ERROR_SUCCESS) {
        return HRESULT_FROM_WIN32(result);
    }
    packageFamilyName->assign(buffer.data());
    return S_OK;
}

std::wstring ContextMenuDisabledMarkerPath() {
    std::wstring packageFamilyName;
    if (FAILED(CurrentPackageFamilyName(&packageFamilyName))) {
        return {};
    }

    const DWORD required = GetEnvironmentVariableW(L"LOCALAPPDATA", nullptr, 0);
    if (required == 0) {
        return {};
    }
    std::vector<wchar_t> buffer(required);
    if (GetEnvironmentVariableW(L"LOCALAPPDATA", buffer.data(), required) == 0) {
        return {};
    }
    std::wstring path(buffer.data());
    path.append(L"\\Packages\\");
    path.append(packageFamilyName);
    path.append(L"\\LocalState\\shell-context-menu.disabled");
    return path;
}

HRESULT GetFilesystemPath(IShellItem* item, std::wstring* path, bool* isFolder) {
    if (item == nullptr || path == nullptr || isFolder == nullptr) {
        return E_POINTER;
    }

    SFGAOF attributes = 0;
    HRESULT result = item->GetAttributes(SFGAO_FILESYSTEM | SFGAO_FOLDER, &attributes);
    if (FAILED(result)) {
        return result;
    }
    if ((attributes & SFGAO_FILESYSTEM) == 0) {
        return HRESULT_FROM_WIN32(ERROR_NOT_SUPPORTED);
    }

    PWSTR rawPath = nullptr;
    result = item->GetDisplayName(SIGDN_FILESYSPATH, &rawPath);
    if (FAILED(result)) {
        return result;
    }
    path->assign(rawPath);
    CoTaskMemFree(rawPath);
    *isFolder = (attributes & SFGAO_FOLDER) != 0;
    return S_OK;
}

HRESULT CollectSelectedPaths(
    IShellItemArray* items,
    NomoCommandKind kind,
    std::vector<std::wstring>* paths) {
    if (paths == nullptr) {
        return E_POINTER;
    }
    paths->clear();

    if (items == nullptr) {
        return kind == NomoCommandKind::Folder ? S_OK : E_INVALIDARG;
    }

    DWORD count = 0;
    HRESULT result = items->GetCount(&count);
    if (FAILED(result)) {
        return result;
    }
    std::vector<NomoSelectionItem> selectedItems;
    selectedItems.reserve(count);

    for (DWORD index = 0; index < count; ++index) {
        ComPtr<IShellItem> item;
        result = items->GetItemAt(index, &item);
        if (FAILED(result)) {
            return result;
        }

        std::wstring path;
        bool isFolder = false;
        result = GetFilesystemPath(item.Get(), &path, &isFolder);
        if (FAILED(result)) {
            return result;
        }
        selectedItems.push_back(NomoSelectionItem{std::move(path), isFolder});
    }

    if (!IsNomoSelectionSupported(kind, selectedItems)) {
        return E_INVALIDARG;
    }
    for (NomoSelectionItem& item : selectedItems) {
        paths->push_back(std::move(item.path));
    }
    return S_OK;
}

HRESULT ActivateNomo(const std::vector<std::wstring>& paths) {
    if (paths.empty()) {
        return E_INVALIDARG;
    }

    std::wstring packageFamilyName;
    HRESULT result = CurrentPackageFamilyName(&packageFamilyName);
    if (FAILED(result)) {
        return result;
    }

    std::wstring applicationUserModelId = packageFamilyName + L"!Nomo";
    const std::wstring arguments = BuildActivationArguments(paths);
    ComPtr<IApplicationActivationManager> activationManager;
    result = CoCreateInstance(
        CLSID_ApplicationActivationManager,
        nullptr,
        CLSCTX_INPROC_SERVER,
        IID_PPV_ARGS(&activationManager));
    if (FAILED(result)) {
        return result;
    }

    DWORD processId = 0;
    return activationManager->ActivateApplication(
        applicationUserModelId.c_str(), arguments.c_str(), AO_NONE, &processId);
}

class NomoExplorerCommand final : public IExplorerCommand, public IObjectWithSite {
public:
    explicit NomoExplorerCommand(NomoCommandKind kind) noexcept : kind_(kind) {
        InterlockedIncrement(&g_liveObjects);
    }

    NomoExplorerCommand(const NomoExplorerCommand&) = delete;
    NomoExplorerCommand& operator=(const NomoExplorerCommand&) = delete;

    IFACEMETHODIMP QueryInterface(REFIID interfaceId, void** object) override {
        if (object == nullptr) {
            return E_POINTER;
        }
        *object = nullptr;
        if (IsEqualIID(interfaceId, IID_IUnknown) ||
            IsEqualIID(interfaceId, IID_IExplorerCommand)) {
            *object = static_cast<IExplorerCommand*>(this);
        } else if (IsEqualIID(interfaceId, IID_IObjectWithSite)) {
            *object = static_cast<IObjectWithSite*>(this);
        } else {
            return E_NOINTERFACE;
        }
        AddRef();
        return S_OK;
    }

    IFACEMETHODIMP_(ULONG) AddRef() override {
        return static_cast<ULONG>(InterlockedIncrement(&referenceCount_));
    }

    IFACEMETHODIMP_(ULONG) Release() override {
        const ULONG remaining = static_cast<ULONG>(InterlockedDecrement(&referenceCount_));
        if (remaining == 0) {
            delete this;
        }
        return remaining;
    }

    IFACEMETHODIMP GetTitle(IShellItemArray*, PWSTR* title) override {
        return CopyStringToCoTaskMem(GetNomoCommandTitle(kind_, CurrentNomoLocale()), title);
    }

    IFACEMETHODIMP GetIcon(IShellItemArray*, PWSTR* icon) override {
        try {
            std::wstring modulePath;
            HRESULT result = CurrentModulePath(&modulePath);
            if (FAILED(result)) {
                return result;
            }
            modulePath.append(L",-101");
            return CopyStringToCoTaskMem(modulePath, icon);
        } catch (...) {
            return E_OUTOFMEMORY;
        }
    }

    IFACEMETHODIMP GetToolTip(IShellItemArray*, PWSTR* toolTip) override {
        if (toolTip != nullptr) {
            *toolTip = nullptr;
        }
        return E_NOTIMPL;
    }

    IFACEMETHODIMP GetCanonicalName(GUID* canonicalName) override {
        if (canonicalName == nullptr) {
            return E_POINTER;
        }
        *canonicalName = kind_ == NomoCommandKind::Markdown
                             ? CLSID_NomoMarkdownCommand
                             : CLSID_NomoFolderCommand;
        return S_OK;
    }

    IFACEMETHODIMP GetState(
        IShellItemArray* items,
        BOOL,
        EXPCMDSTATE* state) override {
        if (state == nullptr) {
            return E_POINTER;
        }
        *state = ECS_HIDDEN;
        try {
            if (IsContextMenuDisabledAtPath(ContextMenuDisabledMarkerPath())) {
                return S_OK;
            }
            std::vector<std::wstring> paths;
            if (SUCCEEDED(CollectSelectedPaths(items, kind_, &paths))) {
                *state = ECS_ENABLED;
            }
            return S_OK;
        } catch (...) {
            return S_OK;
        }
    }

    IFACEMETHODIMP Invoke(IShellItemArray* items, IBindCtx*) override {
        try {
            std::vector<std::wstring> paths;
            HRESULT result = CollectSelectedPaths(items, kind_, &paths);
            if (FAILED(result)) {
                return result;
            }
            if (kind_ == NomoCommandKind::Folder && paths.empty()) {
                std::wstring folderPath;
                result = ResolveBackgroundFolder(&folderPath);
                if (FAILED(result)) {
                    return result;
                }
                paths.push_back(std::move(folderPath));
            }
            return ActivateNomo(paths);
        } catch (...) {
            return E_OUTOFMEMORY;
        }
    }

    IFACEMETHODIMP GetFlags(EXPCMDFLAGS* flags) override {
        if (flags == nullptr) {
            return E_POINTER;
        }
        *flags = ECF_DEFAULT;
        return S_OK;
    }

    IFACEMETHODIMP EnumSubCommands(IEnumExplorerCommand** commands) override {
        if (commands != nullptr) {
            *commands = nullptr;
        }
        return E_NOTIMPL;
    }

    IFACEMETHODIMP SetSite(IUnknown* site) override {
        if (site_ != nullptr) {
            site_->Release();
            site_ = nullptr;
        }
        if (site != nullptr) {
            site->AddRef();
            site_ = site;
        }
        return S_OK;
    }

    IFACEMETHODIMP GetSite(REFIID interfaceId, void** site) override {
        if (site == nullptr) {
            return E_POINTER;
        }
        *site = nullptr;
        return site_ == nullptr ? E_FAIL : site_->QueryInterface(interfaceId, site);
    }

private:
    ~NomoExplorerCommand() {
        if (site_ != nullptr) {
            site_->Release();
        }
        InterlockedDecrement(&g_liveObjects);
    }

    HRESULT ResolveBackgroundFolder(std::wstring* folderPath) {
        if (folderPath == nullptr) {
            return E_POINTER;
        }
        if (site_ == nullptr) {
            return E_FAIL;
        }

        ComPtr<IServiceProvider> serviceProvider;
        HRESULT result = site_->QueryInterface(IID_PPV_ARGS(&serviceProvider));
        if (FAILED(result)) {
            return result;
        }

        ComPtr<IShellBrowser> shellBrowser;
        result = serviceProvider->QueryService(
            SID_STopLevelBrowser, IID_PPV_ARGS(&shellBrowser));
        if (FAILED(result)) {
            return result;
        }

        ComPtr<IShellView> shellView;
        result = shellBrowser->QueryActiveShellView(&shellView);
        if (FAILED(result)) {
            return result;
        }

        ComPtr<IFolderView> folderView;
        result = shellView.As(&folderView);
        if (FAILED(result)) {
            return result;
        }

        ComPtr<IShellItem> folderItem;
        result = folderView->GetFolder(IID_PPV_ARGS(&folderItem));
        if (FAILED(result)) {
            return result;
        }

        bool isFolder = false;
        result = GetFilesystemPath(folderItem.Get(), folderPath, &isFolder);
        return SUCCEEDED(result) && isFolder ? S_OK : E_INVALIDARG;
    }

    volatile long referenceCount_ = 1;
    NomoCommandKind kind_;
    IUnknown* site_ = nullptr;
};

class NomoClassFactory final : public IClassFactory {
public:
    explicit NomoClassFactory(NomoCommandKind kind) noexcept : kind_(kind) {
        InterlockedIncrement(&g_liveObjects);
    }

    IFACEMETHODIMP QueryInterface(REFIID interfaceId, void** object) override {
        if (object == nullptr) {
            return E_POINTER;
        }
        *object = nullptr;
        if (!IsEqualIID(interfaceId, IID_IUnknown) &&
            !IsEqualIID(interfaceId, IID_IClassFactory)) {
            return E_NOINTERFACE;
        }
        *object = static_cast<IClassFactory*>(this);
        AddRef();
        return S_OK;
    }

    IFACEMETHODIMP_(ULONG) AddRef() override {
        return static_cast<ULONG>(InterlockedIncrement(&referenceCount_));
    }

    IFACEMETHODIMP_(ULONG) Release() override {
        const ULONG remaining = static_cast<ULONG>(InterlockedDecrement(&referenceCount_));
        if (remaining == 0) {
            delete this;
        }
        return remaining;
    }

    IFACEMETHODIMP CreateInstance(
        IUnknown* outer,
        REFIID interfaceId,
        void** object) override {
        if (outer != nullptr) {
            return CLASS_E_NOAGGREGATION;
        }
        if (object == nullptr) {
            return E_POINTER;
        }
        *object = nullptr;
        auto* command = new (std::nothrow) NomoExplorerCommand(kind_);
        if (command == nullptr) {
            return E_OUTOFMEMORY;
        }
        const HRESULT result = command->QueryInterface(interfaceId, object);
        command->Release();
        return result;
    }

    IFACEMETHODIMP LockServer(BOOL lock) override {
        if (lock) {
            InterlockedIncrement(&g_liveObjects);
        } else {
            InterlockedDecrement(&g_liveObjects);
        }
        return S_OK;
    }

private:
    ~NomoClassFactory() {
        InterlockedDecrement(&g_liveObjects);
    }

    volatile long referenceCount_ = 1;
    NomoCommandKind kind_;
};

}  // namespace

extern "C" HRESULT __stdcall DllGetClassObject(
    REFCLSID classId,
    REFIID interfaceId,
    void** object) {
    if (object == nullptr) {
        return E_POINTER;
    }
    *object = nullptr;

    NomoCommandKind kind;
    if (IsEqualCLSID(classId, CLSID_NomoMarkdownCommand)) {
        kind = NomoCommandKind::Markdown;
    } else if (IsEqualCLSID(classId, CLSID_NomoFolderCommand)) {
        kind = NomoCommandKind::Folder;
    } else {
        return CLASS_E_CLASSNOTAVAILABLE;
    }

    auto* factory = new (std::nothrow) NomoClassFactory(kind);
    if (factory == nullptr) {
        return E_OUTOFMEMORY;
    }
    const HRESULT result = factory->QueryInterface(interfaceId, object);
    factory->Release();
    return result;
}

extern "C" HRESULT __stdcall DllCanUnloadNow() {
    return InterlockedCompareExchange(&g_liveObjects, 0, 0) == 0 ? S_OK : S_FALSE;
}

BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID) {
    if (reason == DLL_PROCESS_ATTACH) {
        g_module = instance;
        DisableThreadLibraryCalls(instance);
    }
    return TRUE;
}
