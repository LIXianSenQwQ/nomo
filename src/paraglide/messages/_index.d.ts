export type LocalizedString = import("../runtime.js").LocalizedString;
export type Appname1Inputs = {};
export type Settingstitle1Inputs = {};
export type Settingswindowtitle2Inputs = {};
export type Settingscategorygeneral2Inputs = {};
export type Settingscategoryeditor2Inputs = {};
export type Settingscategoryappearance2Inputs = {};
export type Settingscategoryfiles2Inputs = {};
export type Settingscategoryimages2Inputs = {};
export type Settingscategorystats2Inputs = {};
export type Settingscategoryadvanced2Inputs = {};
export type Settingscategoryabout2Inputs = {};
export type Settingscategoryabouttitle3Inputs = {};
export type Interfacelanguage1Inputs = {};
export type Interfacelanguagedescription2Inputs = {};
export type Interfacelanguagesystem2Inputs = {};
export type Interfacelanguagezhcn3Inputs = {};
export type Interfacelanguagezhtw3Inputs = {};
export type Interfacelanguageenus3Inputs = {};
export type Settingssaved1Inputs = {};
export type Settingssaving1Inputs = {};
export type Settingssavefailed2Inputs = {};
export type Settingsloading1Inputs = {};
export type Themedescription1Inputs = {};
export type Themelight1Inputs = {};
export type Themedark1Inputs = {};
export type Themesystem1Inputs = {};
export type Editormodedefault2Inputs = {};
export type Editormodedefaultdescription3Inputs = {};
export type Semanticediting1Inputs = {};
export type Sourcemode1Inputs = {};
export type Autosave1Inputs = {};
export type Autosavedescription2Inputs = {};
export type Restorewindow1Inputs = {};
export type _DeleteInputs = {};
export type Confirmdelete1Inputs = {};
export type Unsavedchangesclosewindow3Inputs = {
    names: NonNullable<unknown>;
};
export type Unsavedchangesexitapp3Inputs = {
    names: NonNullable<unknown>;
};
export type Unsavedchangesclosetabs3Inputs = {
    names: NonNullable<unknown>;
};
export type Closetotrayfirstprompt4Inputs = {};
export type Foldermissing1Inputs = {};
export type Filemissing1Inputs = {};
export type Previewopenfailed2Inputs = {};
export type Removedfromexplorer2Inputs = {
    message: NonNullable<unknown>;
};
export type Currentfolder1Inputs = {};
export type Newfolder1Inputs = {};
export type Untitledmarkdown1Inputs = {};
export type Deletedtype1Inputs = {
    type: NonNullable<unknown>;
};
export type Deletefailed1Inputs = {
    error: NonNullable<unknown>;
};
export type Createfolderfailed2Inputs = {
    error: NonNullable<unknown>;
};
export type Renamefailed1Inputs = {
    error: NonNullable<unknown>;
};
export type Largedocumentreadonly2Inputs = {};
export type Sampleopenfailed2Inputs = {
    error: NonNullable<unknown>;
};
export type Sampleopened1Inputs = {};
export type Readonlycannoteditlink3Inputs = {};
export type Switchsemanticbeforeeditlink4Inputs = {};
export type Openinglink1Inputs = {};
export type Openinglinkshort2Inputs = {};
export type Openlinkfailed2Inputs = {
    error: NonNullable<unknown>;
};
export type Linkhrefrequired2Inputs = {};
export type Linkhrefinvalid2Inputs = {};
export type Linknothingtoremove3Inputs = {};
export type Readonlycannoteditmetadata3Inputs = {};
export type Readonlycannotdeletemetadata3Inputs = {};
export type Featurecomingsoon2Inputs = {
    featureName: NonNullable<unknown>;
};
export type Zoomstatus1Inputs = {
    percent: NonNullable<unknown>;
};
export type Imagecleanupremovedfailed3Inputs = {
    removed: NonNullable<unknown>;
    failed: NonNullable<unknown>;
};
export type Imagecleanupremoved2Inputs = {
    removed: NonNullable<unknown>;
};
export type Imagecleanupfailed2Inputs = {
    failed: NonNullable<unknown>;
};
export type Confirmdeletemessage2Inputs = {
    type: NonNullable<unknown>;
    name: NonNullable<unknown>;
};
export type Externalfilechanged2Inputs = {};
export type Reloadexternalversion2Inputs = {};
export type Saveascurrentcontent3Inputs = {};
export type Overwriteexternalversion2Inputs = {};
export type Markdownsource1Inputs = {};
export type Semanticeditorarea2Inputs = {};
export type Documentoutline1Inputs = {};
export type Expandheading1Inputs = {};
export type Collapseheading1Inputs = {};
export type Expandnamedheading2Inputs = {
    title: NonNullable<unknown>;
};
export type Collapsenamedheading2Inputs = {
    title: NonNullable<unknown>;
};
export type Documenthasnoheadings3Inputs = {};
export type Folderopenquestion2Inputs = {
    folderName: NonNullable<unknown>;
};
export type Openincurrentwindow3Inputs = {};
export type Openinnewwindow3Inputs = {};
export type Rememberfolderopenchoice3Inputs = {};
export type Calloutnote1Inputs = {};
export type Callouttip1Inputs = {};
export type Calloutimportant1Inputs = {};
export type Calloutwarning1Inputs = {};
export type Calloutcaution1Inputs = {};
export type Confirmdeletemetadata2Inputs = {};
export type Deletemetadata1Inputs = {};
export type Documentmetadata1Inputs = {};
export type Documentmetadataediting2Inputs = {};
export type Editdocumentmetadatacontent3Inputs = {};
export type Viewdocumentmetadata2Inputs = {};
export type Editdocumentmetadata2Inputs = {};
export type Metadatacreated1Inputs = {
    date: NonNullable<unknown>;
};
export type Metadataupdated1Inputs = {
    date: NonNullable<unknown>;
};
export type Metadatamorefields2Inputs = {
    count: NonNullable<unknown>;
};
export type Editlink1Inputs = {};
export type Linktitleplaceholder2Inputs = {};
export type Linktitle1Inputs = {};
export type Linkhref1Inputs = {};
export type Applylink1Inputs = {};
export type Removelink1Inputs = {};
export type Closelinkeditor2Inputs = {};
export type Interfacelanguagejajp3Inputs = {};
/**
* | output |
* | --- |
* | "Nomo" |
*
* @param {Appname1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const appname1: ((inputs?: Appname1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Appname1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Preferences" |
*
* @param {Settingstitle1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingstitle1: ((inputs?: Settingstitle1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingstitle1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Preferences - Nomo" |
*
* @param {Settingswindowtitle2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingswindowtitle2: ((inputs?: Settingswindowtitle2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingswindowtitle2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "General" |
*
* @param {Settingscategorygeneral2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingscategorygeneral2: ((inputs?: Settingscategorygeneral2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingscategorygeneral2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Editor" |
*
* @param {Settingscategoryeditor2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingscategoryeditor2: ((inputs?: Settingscategoryeditor2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingscategoryeditor2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Appearance" |
*
* @param {Settingscategoryappearance2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingscategoryappearance2: ((inputs?: Settingscategoryappearance2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingscategoryappearance2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Files & Windows" |
*
* @param {Settingscategoryfiles2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingscategoryfiles2: ((inputs?: Settingscategoryfiles2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingscategoryfiles2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Images" |
*
* @param {Settingscategoryimages2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingscategoryimages2: ((inputs?: Settingscategoryimages2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingscategoryimages2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Stats & Outline" |
*
* @param {Settingscategorystats2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingscategorystats2: ((inputs?: Settingscategorystats2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingscategorystats2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Advanced" |
*
* @param {Settingscategoryadvanced2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingscategoryadvanced2: ((inputs?: Settingscategoryadvanced2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingscategoryadvanced2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "About" |
*
* @param {Settingscategoryabout2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingscategoryabout2: ((inputs?: Settingscategoryabout2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingscategoryabout2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "About Nomo" |
*
* @param {Settingscategoryabouttitle3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingscategoryabouttitle3: ((inputs?: Settingscategoryabouttitle3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingscategoryabouttitle3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Interface language" |
*
* @param {Interfacelanguage1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const interfacelanguage1: ((inputs?: Interfacelanguage1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Interfacelanguage1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Controls app UI, menus, and messages. It never rewrites the current Markdown document." |
*
* @param {Interfacelanguagedescription2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const interfacelanguagedescription2: ((inputs?: Interfacelanguagedescription2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Interfacelanguagedescription2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Follow system" |
*
* @param {Interfacelanguagesystem2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const interfacelanguagesystem2: ((inputs?: Interfacelanguagesystem2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Interfacelanguagesystem2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "简体中文" |
*
* @param {Interfacelanguagezhcn3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const interfacelanguagezhcn3: ((inputs?: Interfacelanguagezhcn3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Interfacelanguagezhcn3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "繁體中文" |
*
* @param {Interfacelanguagezhtw3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const interfacelanguagezhtw3: ((inputs?: Interfacelanguagezhtw3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Interfacelanguagezhtw3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "English" |
*
* @param {Interfacelanguageenus3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const interfacelanguageenus3: ((inputs?: Interfacelanguageenus3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Interfacelanguageenus3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Saved automatically" |
*
* @param {Settingssaved1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingssaved1: ((inputs?: Settingssaved1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingssaved1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Saving..." |
*
* @param {Settingssaving1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingssaving1: ((inputs?: Settingssaving1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingssaving1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Failed to save settings" |
*
* @param {Settingssavefailed2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingssavefailed2: ((inputs?: Settingssavefailed2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingssavefailed2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Reading settings..." |
*
* @param {Settingsloading1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const settingsloading1: ((inputs?: Settingsloading1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Settingsloading1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Syncs to the main window and render services after saving." |
*
* @param {Themedescription1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const themedescription1: ((inputs?: Themedescription1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Themedescription1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Light" |
*
* @param {Themelight1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const themelight1: ((inputs?: Themelight1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Themelight1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Dark" |
*
* @param {Themedark1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const themedark1: ((inputs?: Themedark1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Themedark1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "System" |
*
* @param {Themesystem1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const themesystem1: ((inputs?: Themesystem1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Themesystem1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Default startup edit mode" |
*
* @param {Editormodedefault2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const editormodedefault2: ((inputs?: Editormodedefault2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Editormodedefault2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Used as the default editing mode the next time a document opens." |
*
* @param {Editormodedefaultdescription3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const editormodedefaultdescription3: ((inputs?: Editormodedefaultdescription3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Editormodedefaultdescription3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Semantic editing" |
*
* @param {Semanticediting1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const semanticediting1: ((inputs?: Semanticediting1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Semanticediting1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Source mode" |
*
* @param {Sourcemode1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const sourcemode1: ((inputs?: Sourcemode1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sourcemode1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Auto save" |
*
* @param {Autosave1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const autosave1: ((inputs?: Autosave1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Autosave1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Automatically writes edits to the current local file." |
*
* @param {Autosavedescription2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const autosavedescription2: ((inputs?: Autosavedescription2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Autosavedescription2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Restore window" |
*
* @param {Restorewindow1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const restorewindow1: ((inputs?: Restorewindow1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Restorewindow1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Delete" |
*
* @param {_DeleteInputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const _delete: ((inputs?: _DeleteInputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<_DeleteInputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Confirm delete" |
*
* @param {Confirmdelete1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const confirmdelete1: ((inputs?: Confirmdelete1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Confirmdelete1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "These files have unsaved changes: {names}. Closing the window will discard them. Continue?" |
*
* @param {Unsavedchangesclosewindow3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const unsavedchangesclosewindow3: ((inputs: Unsavedchangesclosewindow3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Unsavedchangesclosewindow3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "These files have unsaved changes: {names}. Quitting the app will discard them. Continue?" |
*
* @param {Unsavedchangesexitapp3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const unsavedchangesexitapp3: ((inputs: Unsavedchangesexitapp3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Unsavedchangesexitapp3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "These files have unsaved changes: {names}. Closing will discard them. Continue?" |
*
* @param {Unsavedchangesclosetabs3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const unsavedchangesclosetabs3: ((inputs: Unsavedchangesclosetabs3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Unsavedchangesclosetabs3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "When closing the main window for the first time, hide Nomo to the system tray? OK: hide to tray and remember this choice. Cancel: close the window directly. ..." |
*
* @param {Closetotrayfirstprompt4Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const closetotrayfirstprompt4: ((inputs?: Closetotrayfirstprompt4Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Closetotrayfirstprompt4Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "The folder does not exist or has been moved" |
*
* @param {Foldermissing1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const foldermissing1: ((inputs?: Foldermissing1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Foldermissing1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "The file does not exist or has been moved" |
*
* @param {Filemissing1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const filemissing1: ((inputs?: Filemissing1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Filemissing1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Failed to open preview" |
*
* @param {Previewopenfailed2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const previewopenfailed2: ((inputs?: Previewopenfailed2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Previewopenfailed2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "{message}; removed from Explorer" |
*
* @param {Removedfromexplorer2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const removedfromexplorer2: ((inputs: Removedfromexplorer2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Removedfromexplorer2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Current folder" |
*
* @param {Currentfolder1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const currentfolder1: ((inputs?: Currentfolder1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Currentfolder1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "New folder" |
*
* @param {Newfolder1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const newfolder1: ((inputs?: Newfolder1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Newfolder1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Untitled.md" |
*
* @param {Untitledmarkdown1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const untitledmarkdown1: ((inputs?: Untitledmarkdown1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Untitledmarkdown1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Deleted {type}" |
*
* @param {Deletedtype1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const deletedtype1: ((inputs: Deletedtype1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Deletedtype1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Delete failed: {error}" |
*
* @param {Deletefailed1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const deletefailed1: ((inputs: Deletefailed1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Deletefailed1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Failed to create folder: {error}" |
*
* @param {Createfolderfailed2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const createfolderfailed2: ((inputs: Createfolderfailed2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Createfolderfailed2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Rename failed: {error}" |
*
* @param {Renamefailed1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const renamefailed1: ((inputs: Renamefailed1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Renamefailed1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "The current document switched to read-only source mode because it exceeds the large-file threshold" |
*
* @param {Largedocumentreadonly2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const largedocumentreadonly2: ((inputs?: Largedocumentreadonly2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Largedocumentreadonly2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Failed to open sample document: {error}" |
*
* @param {Sampleopenfailed2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const sampleopenfailed2: ((inputs: Sampleopenfailed2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sampleopenfailed2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Sample document opened" |
*
* @param {Sampleopened1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const sampleopened1: ((inputs?: Sampleopened1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sampleopened1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "The current document is read-only, so links cannot be edited" |
*
* @param {Readonlycannoteditlink3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const readonlycannoteditlink3: ((inputs?: Readonlycannoteditlink3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Readonlycannoteditlink3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Switch to semantic mode before editing links" |
*
* @param {Switchsemanticbeforeeditlink4Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const switchsemanticbeforeeditlink4: ((inputs?: Switchsemanticbeforeeditlink4Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Switchsemanticbeforeeditlink4Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Opening link..." |
*
* @param {Openinglink1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const openinglink1: ((inputs?: Openinglink1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Openinglink1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Opening link" |
*
* @param {Openinglinkshort2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const openinglinkshort2: ((inputs?: Openinglinkshort2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Openinglinkshort2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Failed to open link: {error}" |
*
* @param {Openlinkfailed2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const openlinkfailed2: ((inputs: Openlinkfailed2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Openlinkfailed2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Enter a link address" |
*
* @param {Linkhrefrequired2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const linkhrefrequired2: ((inputs?: Linkhrefrequired2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Linkhrefrequired2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "The link address is unavailable. Use http(s), mailto, an anchor, or a relative path." |
*
* @param {Linkhrefinvalid2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const linkhrefinvalid2: ((inputs?: Linkhrefinvalid2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Linkhrefinvalid2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "The current selection has no link to remove" |
*
* @param {Linknothingtoremove3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const linknothingtoremove3: ((inputs?: Linknothingtoremove3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Linknothingtoremove3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "The current document is read-only, so metadata cannot be edited" |
*
* @param {Readonlycannoteditmetadata3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const readonlycannoteditmetadata3: ((inputs?: Readonlycannoteditmetadata3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Readonlycannoteditmetadata3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "The current document is read-only, so metadata cannot be deleted" |
*
* @param {Readonlycannotdeletemetadata3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const readonlycannotdeletemetadata3: ((inputs?: Readonlycannotdeletemetadata3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Readonlycannotdeletemetadata3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "{featureName} is coming soon" |
*
* @param {Featurecomingsoon2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const featurecomingsoon2: ((inputs: Featurecomingsoon2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Featurecomingsoon2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Zoom {percent}%" |
*
* @param {Zoomstatus1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const zoomstatus1: ((inputs: Zoomstatus1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Zoomstatus1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Deleted {removed} image files; {failed} failed" |
*
* @param {Imagecleanupremovedfailed3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const imagecleanupremovedfailed3: ((inputs: Imagecleanupremovedfailed3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Imagecleanupremovedfailed3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Deleted {removed} image files" |
*
* @param {Imagecleanupremoved2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const imagecleanupremoved2: ((inputs: Imagecleanupremoved2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Imagecleanupremoved2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "{failed} image files failed to delete" |
*
* @param {Imagecleanupfailed2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const imagecleanupfailed2: ((inputs: Imagecleanupfailed2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Imagecleanupfailed2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Delete {type} \"{name}\"?" |
*
* @param {Confirmdeletemessage2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const confirmdeletemessage2: ((inputs: Confirmdeletemessage2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Confirmdeletemessage2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "External file changed" |
*
* @param {Externalfilechanged2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const externalfilechanged2: ((inputs?: Externalfilechanged2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Externalfilechanged2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Reload external version" |
*
* @param {Reloadexternalversion2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const reloadexternalversion2: ((inputs?: Reloadexternalversion2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Reloadexternalversion2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Save current content as..." |
*
* @param {Saveascurrentcontent3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const saveascurrentcontent3: ((inputs?: Saveascurrentcontent3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Saveascurrentcontent3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Overwrite external version" |
*
* @param {Overwriteexternalversion2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const overwriteexternalversion2: ((inputs?: Overwriteexternalversion2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Overwriteexternalversion2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Markdown source" |
*
* @param {Markdownsource1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const markdownsource1: ((inputs?: Markdownsource1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Markdownsource1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Semantic editor" |
*
* @param {Semanticeditorarea2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const semanticeditorarea2: ((inputs?: Semanticeditorarea2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Semanticeditorarea2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Document outline" |
*
* @param {Documentoutline1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const documentoutline1: ((inputs?: Documentoutline1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Documentoutline1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Expand heading" |
*
* @param {Expandheading1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const expandheading1: ((inputs?: Expandheading1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Expandheading1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Collapse heading" |
*
* @param {Collapseheading1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const collapseheading1: ((inputs?: Collapseheading1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Collapseheading1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Expand {title}" |
*
* @param {Expandnamedheading2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const expandnamedheading2: ((inputs: Expandnamedheading2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Expandnamedheading2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Collapse {title}" |
*
* @param {Collapsenamedheading2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const collapsenamedheading2: ((inputs: Collapsenamedheading2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Collapsenamedheading2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "This document has no headings yet" |
*
* @param {Documenthasnoheadings3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const documenthasnoheadings3: ((inputs?: Documenthasnoheadings3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Documenthasnoheadings3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "How should “{folderName}” open?" |
*
* @param {Folderopenquestion2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const folderopenquestion2: ((inputs: Folderopenquestion2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Folderopenquestion2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Open here" |
*
* @param {Openincurrentwindow3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const openincurrentwindow3: ((inputs?: Openincurrentwindow3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Openincurrentwindow3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Open in new window" |
*
* @param {Openinnewwindow3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const openinnewwindow3: ((inputs?: Openinnewwindow3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Openinnewwindow3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Do not ask again, and remember my choice" |
*
* @param {Rememberfolderopenchoice3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const rememberfolderopenchoice3: ((inputs?: Rememberfolderopenchoice3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Rememberfolderopenchoice3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Note" |
*
* @param {Calloutnote1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const calloutnote1: ((inputs?: Calloutnote1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Calloutnote1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Tip" |
*
* @param {Callouttip1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const callouttip1: ((inputs?: Callouttip1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Callouttip1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Important" |
*
* @param {Calloutimportant1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const calloutimportant1: ((inputs?: Calloutimportant1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Calloutimportant1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Warning" |
*
* @param {Calloutwarning1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const calloutwarning1: ((inputs?: Calloutwarning1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Calloutwarning1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Caution" |
*
* @param {Calloutcaution1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const calloutcaution1: ((inputs?: Calloutcaution1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Calloutcaution1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Confirm metadata deletion" |
*
* @param {Confirmdeletemetadata2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const confirmdeletemetadata2: ((inputs?: Confirmdeletemetadata2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Confirmdeletemetadata2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Delete metadata" |
*
* @param {Deletemetadata1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const deletemetadata1: ((inputs?: Deletemetadata1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Deletemetadata1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Document metadata" |
*
* @param {Documentmetadata1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const documentmetadata1: ((inputs?: Documentmetadata1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Documentmetadata1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Document metadata edit mode" |
*
* @param {Documentmetadataediting2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const documentmetadataediting2: ((inputs?: Documentmetadataediting2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Documentmetadataediting2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Edit document metadata content" |
*
* @param {Editdocumentmetadatacontent3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const editdocumentmetadatacontent3: ((inputs?: Editdocumentmetadatacontent3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Editdocumentmetadatacontent3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "View document metadata" |
*
* @param {Viewdocumentmetadata2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const viewdocumentmetadata2: ((inputs?: Viewdocumentmetadata2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Viewdocumentmetadata2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Edit document metadata" |
*
* @param {Editdocumentmetadata2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const editdocumentmetadata2: ((inputs?: Editdocumentmetadata2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Editdocumentmetadata2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Created {date}" |
*
* @param {Metadatacreated1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const metadatacreated1: ((inputs: Metadatacreated1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Metadatacreated1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Updated {date}" |
*
* @param {Metadataupdated1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const metadataupdated1: ((inputs: Metadataupdated1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Metadataupdated1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "{count} more metadata fields" |
*
* @param {Metadatamorefields2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const metadatamorefields2: ((inputs: Metadatamorefields2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Metadatamorefields2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Edit link" |
*
* @param {Editlink1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const editlink1: ((inputs?: Editlink1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Editlink1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Title (display text)" |
*
* @param {Linktitleplaceholder2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const linktitleplaceholder2: ((inputs?: Linktitleplaceholder2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Linktitleplaceholder2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Title" |
*
* @param {Linktitle1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const linktitle1: ((inputs?: Linktitle1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Linktitle1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Link address" |
*
* @param {Linkhref1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const linkhref1: ((inputs?: Linkhref1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Linkhref1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Apply link" |
*
* @param {Applylink1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const applylink1: ((inputs?: Applylink1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Applylink1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Remove link" |
*
* @param {Removelink1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const removelink1: ((inputs?: Removelink1Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Removelink1Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Close link editor" |
*
* @param {Closelinkeditor2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const closelinkeditor2: ((inputs?: Closelinkeditor2Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Closelinkeditor2Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
/**
* | output |
* | --- |
* | "Japanese" |
*
* @param {Interfacelanguagejajp3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
declare const interfacelanguagejajp3: ((inputs?: Interfacelanguagejajp3Inputs, options?: {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Interfacelanguagejajp3Inputs, {
    locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP";
}, {}>;
export { appname1 as "appName", settingstitle1 as "settingsTitle", settingswindowtitle2 as "settingsWindowTitle", settingscategorygeneral2 as "settingsCategoryGeneral", settingscategoryeditor2 as "settingsCategoryEditor", settingscategoryappearance2 as "settingsCategoryAppearance", settingscategoryfiles2 as "settingsCategoryFiles", settingscategoryimages2 as "settingsCategoryImages", settingscategorystats2 as "settingsCategoryStats", settingscategoryadvanced2 as "settingsCategoryAdvanced", settingscategoryabout2 as "settingsCategoryAbout", settingscategoryabouttitle3 as "settingsCategoryAboutTitle", interfacelanguage1 as "interfaceLanguage", interfacelanguagedescription2 as "interfaceLanguageDescription", interfacelanguagesystem2 as "interfaceLanguageSystem", interfacelanguagezhcn3 as "interfaceLanguageZhCn", interfacelanguagezhtw3 as "interfaceLanguageZhTw", interfacelanguageenus3 as "interfaceLanguageEnUs", settingssaved1 as "settingsSaved", settingssaving1 as "settingsSaving", settingssavefailed2 as "settingsSaveFailed", settingsloading1 as "settingsLoading", themedescription1 as "themeDescription", themelight1 as "themeLight", themedark1 as "themeDark", themesystem1 as "themeSystem", editormodedefault2 as "editorModeDefault", editormodedefaultdescription3 as "editorModeDefaultDescription", semanticediting1 as "semanticEditing", sourcemode1 as "sourceMode", autosave1 as "autoSave", autosavedescription2 as "autoSaveDescription", restorewindow1 as "restoreWindow", _delete as "delete", confirmdelete1 as "confirmDelete", unsavedchangesclosewindow3 as "unsavedChangesCloseWindow", unsavedchangesexitapp3 as "unsavedChangesExitApp", unsavedchangesclosetabs3 as "unsavedChangesCloseTabs", closetotrayfirstprompt4 as "closeToTrayFirstPrompt", foldermissing1 as "folderMissing", filemissing1 as "fileMissing", previewopenfailed2 as "previewOpenFailed", removedfromexplorer2 as "removedFromExplorer", currentfolder1 as "currentFolder", newfolder1 as "newFolder", untitledmarkdown1 as "untitledMarkdown", deletedtype1 as "deletedType", deletefailed1 as "deleteFailed", createfolderfailed2 as "createFolderFailed", renamefailed1 as "renameFailed", largedocumentreadonly2 as "largeDocumentReadonly", sampleopenfailed2 as "sampleOpenFailed", sampleopened1 as "sampleOpened", readonlycannoteditlink3 as "readonlyCannotEditLink", switchsemanticbeforeeditlink4 as "switchSemanticBeforeEditLink", openinglink1 as "openingLink", openinglinkshort2 as "openingLinkShort", openlinkfailed2 as "openLinkFailed", linkhrefrequired2 as "linkHrefRequired", linkhrefinvalid2 as "linkHrefInvalid", linknothingtoremove3 as "linkNothingToRemove", readonlycannoteditmetadata3 as "readonlyCannotEditMetadata", readonlycannotdeletemetadata3 as "readonlyCannotDeleteMetadata", featurecomingsoon2 as "featureComingSoon", zoomstatus1 as "zoomStatus", imagecleanupremovedfailed3 as "imageCleanupRemovedFailed", imagecleanupremoved2 as "imageCleanupRemoved", imagecleanupfailed2 as "imageCleanupFailed", confirmdeletemessage2 as "confirmDeleteMessage", externalfilechanged2 as "externalFileChanged", reloadexternalversion2 as "reloadExternalVersion", saveascurrentcontent3 as "saveAsCurrentContent", overwriteexternalversion2 as "overwriteExternalVersion", markdownsource1 as "markdownSource", semanticeditorarea2 as "semanticEditorArea", documentoutline1 as "documentOutline", expandheading1 as "expandHeading", collapseheading1 as "collapseHeading", expandnamedheading2 as "expandNamedHeading", collapsenamedheading2 as "collapseNamedHeading", documenthasnoheadings3 as "documentHasNoHeadings", folderopenquestion2 as "folderOpenQuestion", openincurrentwindow3 as "openInCurrentWindow", openinnewwindow3 as "openInNewWindow", rememberfolderopenchoice3 as "rememberFolderOpenChoice", calloutnote1 as "calloutNote", callouttip1 as "calloutTip", calloutimportant1 as "calloutImportant", calloutwarning1 as "calloutWarning", calloutcaution1 as "calloutCaution", confirmdeletemetadata2 as "confirmDeleteMetadata", deletemetadata1 as "deleteMetadata", documentmetadata1 as "documentMetadata", documentmetadataediting2 as "documentMetadataEditing", editdocumentmetadatacontent3 as "editDocumentMetadataContent", viewdocumentmetadata2 as "viewDocumentMetadata", editdocumentmetadata2 as "editDocumentMetadata", metadatacreated1 as "metadataCreated", metadataupdated1 as "metadataUpdated", metadatamorefields2 as "metadataMoreFields", editlink1 as "editLink", linktitleplaceholder2 as "linkTitlePlaceholder", linktitle1 as "linkTitle", linkhref1 as "linkHref", applylink1 as "applyLink", removelink1 as "removeLink", closelinkeditor2 as "closeLinkEditor", interfacelanguagejajp3 as "interfaceLanguageJaJp" };
