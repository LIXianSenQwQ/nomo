/* eslint-disable */
import { getLocale, experimentalStaticLocale } from "../runtime.js"

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */
/** @typedef {{}} Appname1Inputs */
/** @typedef {{}} Settingstitle1Inputs */
/** @typedef {{}} Settingswindowtitle2Inputs */
/** @typedef {{}} Settingscategorygeneral2Inputs */
/** @typedef {{}} Settingscategoryeditor2Inputs */
/** @typedef {{}} Settingscategoryappearance2Inputs */
/** @typedef {{}} Settingscategoryfiles2Inputs */
/** @typedef {{}} Settingscategoryimages2Inputs */
/** @typedef {{}} Settingscategorystats2Inputs */
/** @typedef {{}} Settingscategoryadvanced2Inputs */
/** @typedef {{}} Settingscategoryabout2Inputs */
/** @typedef {{}} Settingscategoryabouttitle3Inputs */
/** @typedef {{}} Interfacelanguage1Inputs */
/** @typedef {{}} Interfacelanguagedescription2Inputs */
/** @typedef {{}} Interfacelanguagesystem2Inputs */
/** @typedef {{}} Interfacelanguagezhcn3Inputs */
/** @typedef {{}} Interfacelanguagezhtw3Inputs */
/** @typedef {{}} Interfacelanguageenus3Inputs */
/** @typedef {{}} Settingssaved1Inputs */
/** @typedef {{}} Settingssaving1Inputs */
/** @typedef {{}} Settingssavefailed2Inputs */
/** @typedef {{}} Settingsloading1Inputs */
/** @typedef {{}} Themedescription1Inputs */
/** @typedef {{}} Themelight1Inputs */
/** @typedef {{}} Themedark1Inputs */
/** @typedef {{}} Themesystem1Inputs */
/** @typedef {{}} Editormodedefault2Inputs */
/** @typedef {{}} Editormodedefaultdescription3Inputs */
/** @typedef {{}} Semanticediting1Inputs */
/** @typedef {{}} Sourcemode1Inputs */
/** @typedef {{}} Autosave1Inputs */
/** @typedef {{}} Autosavedescription2Inputs */
/** @typedef {{}} Restorewindow1Inputs */
/** @typedef {{}} _DeleteInputs */
/** @typedef {{}} Confirmdelete1Inputs */
/** @typedef {{ names: NonNullable<unknown> }} Unsavedchangesclosewindow3Inputs */
/** @typedef {{ names: NonNullable<unknown> }} Unsavedchangesexitapp3Inputs */
/** @typedef {{ names: NonNullable<unknown> }} Unsavedchangesclosetabs3Inputs */
/** @typedef {{}} Closetotrayfirstprompt4Inputs */
/** @typedef {{}} Foldermissing1Inputs */
/** @typedef {{}} Filemissing1Inputs */
/** @typedef {{}} Previewopenfailed2Inputs */
/** @typedef {{ message: NonNullable<unknown> }} Removedfromexplorer2Inputs */
/** @typedef {{}} FileInputs */
/** @typedef {{}} FolderInputs */
/** @typedef {{}} Currentfolder1Inputs */
/** @typedef {{}} Newfolder1Inputs */
/** @typedef {{}} Untitledmarkdown1Inputs */
/** @typedef {{ type: NonNullable<unknown> }} Deletedtype1Inputs */
/** @typedef {{ error: NonNullable<unknown> }} Deletefailed1Inputs */
/** @typedef {{ error: NonNullable<unknown> }} Createfolderfailed2Inputs */
/** @typedef {{ error: NonNullable<unknown> }} Renamefailed1Inputs */
/** @typedef {{}} Largedocumentreadonly2Inputs */
/** @typedef {{ error: NonNullable<unknown> }} Sampleopenfailed2Inputs */
/** @typedef {{}} Sampleopened1Inputs */
/** @typedef {{}} Readonlycannoteditlink3Inputs */
/** @typedef {{}} Switchsemanticbeforeeditlink4Inputs */
/** @typedef {{}} Openinglink1Inputs */
/** @typedef {{}} Openinglinkshort2Inputs */
/** @typedef {{ error: NonNullable<unknown> }} Openlinkfailed2Inputs */
/** @typedef {{}} Linkhrefrequired2Inputs */
/** @typedef {{}} Linkhrefinvalid2Inputs */
/** @typedef {{}} Linknothingtoremove3Inputs */
/** @typedef {{}} Readonlycannoteditmetadata3Inputs */
/** @typedef {{}} Readonlycannotdeletemetadata3Inputs */
/** @typedef {{ featureName: NonNullable<unknown> }} Featurecomingsoon2Inputs */
/** @typedef {{ percent: NonNullable<unknown> }} Zoomstatus1Inputs */
/** @typedef {{ removed: NonNullable<unknown>, failed: NonNullable<unknown> }} Imagecleanupremovedfailed3Inputs */
/** @typedef {{ removed: NonNullable<unknown> }} Imagecleanupremoved2Inputs */
/** @typedef {{ failed: NonNullable<unknown> }} Imagecleanupfailed2Inputs */
/** @typedef {{ type: NonNullable<unknown>, name: NonNullable<unknown> }} Confirmdeletemessage2Inputs */
/** @typedef {{}} Externalfilechanged2Inputs */
/** @typedef {{}} Reloadexternalversion2Inputs */
/** @typedef {{}} Saveascurrentcontent3Inputs */
/** @typedef {{}} Overwriteexternalversion2Inputs */
/** @typedef {{}} Markdownsource1Inputs */
/** @typedef {{}} Semanticeditorarea2Inputs */
/** @typedef {{}} Documentoutline1Inputs */
/** @typedef {{}} Expandheading1Inputs */
/** @typedef {{}} Collapseheading1Inputs */
/** @typedef {{ title: NonNullable<unknown> }} Expandnamedheading2Inputs */
/** @typedef {{ title: NonNullable<unknown> }} Collapsenamedheading2Inputs */
/** @typedef {{}} Documenthasnoheadings3Inputs */
/** @typedef {{ folderName: NonNullable<unknown> }} Folderopenquestion2Inputs */
/** @typedef {{}} Openincurrentwindow3Inputs */
/** @typedef {{}} Openinnewwindow3Inputs */
/** @typedef {{}} Rememberfolderopenchoice3Inputs */
/** @typedef {{}} Calloutnote1Inputs */
/** @typedef {{}} Callouttip1Inputs */
/** @typedef {{}} Calloutimportant1Inputs */
/** @typedef {{}} Calloutwarning1Inputs */
/** @typedef {{}} Calloutcaution1Inputs */
/** @typedef {{}} Confirmdeletemetadata2Inputs */
/** @typedef {{}} Deletemetadata1Inputs */
/** @typedef {{}} Documentmetadata1Inputs */
/** @typedef {{}} Documentmetadataediting2Inputs */
/** @typedef {{}} Editdocumentmetadatacontent3Inputs */
/** @typedef {{}} Viewdocumentmetadata2Inputs */
/** @typedef {{}} Editdocumentmetadata2Inputs */
/** @typedef {{ date: NonNullable<unknown> }} Metadatacreated1Inputs */
/** @typedef {{ date: NonNullable<unknown> }} Metadataupdated1Inputs */
/** @typedef {{ count: NonNullable<unknown> }} Metadatamorefields2Inputs */
/** @typedef {{}} Editlink1Inputs */
/** @typedef {{}} Linktitleplaceholder2Inputs */
/** @typedef {{}} Linktitle1Inputs */
/** @typedef {{}} Linkhref1Inputs */
/** @typedef {{}} Applylink1Inputs */
/** @typedef {{}} Removelink1Inputs */
/** @typedef {{}} Closelinkeditor2Inputs */
/** @typedef {{}} Interfacelanguagejajp3Inputs */
import * as __zh_cn2 from "./zh-CN.js"
import * as __zh_tw2 from "./zh-TW.js"
import * as __en_us2 from "./en-US.js"
import * as __ja_jp2 from "./ja-JP.js"
/**
* | output |
* | --- |
* | "Nomo" |
*
* @param {Appname1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const appname1 = /** @type {((inputs?: Appname1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Appname1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.appname1(inputs)
	if (locale === "zh-TW") return __zh_tw2.appname1(inputs)
	if (locale === "en-US") return __en_us2.appname1(inputs)
	return __ja_jp2.appname1(inputs)
});
export { appname1 as "appName" }
/**
* | output |
* | --- |
* | "Preferences" |
*
* @param {Settingstitle1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingstitle1 = /** @type {((inputs?: Settingstitle1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingstitle1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingstitle1(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingstitle1(inputs)
	if (locale === "en-US") return __en_us2.settingstitle1(inputs)
	return __ja_jp2.settingstitle1(inputs)
});
export { settingstitle1 as "settingsTitle" }
/**
* | output |
* | --- |
* | "Preferences - Nomo" |
*
* @param {Settingswindowtitle2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingswindowtitle2 = /** @type {((inputs?: Settingswindowtitle2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingswindowtitle2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingswindowtitle2(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingswindowtitle2(inputs)
	if (locale === "en-US") return __en_us2.settingswindowtitle2(inputs)
	return __ja_jp2.settingswindowtitle2(inputs)
});
export { settingswindowtitle2 as "settingsWindowTitle" }
/**
* | output |
* | --- |
* | "General" |
*
* @param {Settingscategorygeneral2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingscategorygeneral2 = /** @type {((inputs?: Settingscategorygeneral2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingscategorygeneral2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingscategorygeneral2(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingscategorygeneral2(inputs)
	if (locale === "en-US") return __en_us2.settingscategorygeneral2(inputs)
	return __ja_jp2.settingscategorygeneral2(inputs)
});
export { settingscategorygeneral2 as "settingsCategoryGeneral" }
/**
* | output |
* | --- |
* | "Editor" |
*
* @param {Settingscategoryeditor2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingscategoryeditor2 = /** @type {((inputs?: Settingscategoryeditor2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingscategoryeditor2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingscategoryeditor2(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingscategoryeditor2(inputs)
	if (locale === "en-US") return __en_us2.settingscategoryeditor2(inputs)
	return __ja_jp2.settingscategoryeditor2(inputs)
});
export { settingscategoryeditor2 as "settingsCategoryEditor" }
/**
* | output |
* | --- |
* | "Appearance" |
*
* @param {Settingscategoryappearance2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingscategoryappearance2 = /** @type {((inputs?: Settingscategoryappearance2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingscategoryappearance2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingscategoryappearance2(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingscategoryappearance2(inputs)
	if (locale === "en-US") return __en_us2.settingscategoryappearance2(inputs)
	return __ja_jp2.settingscategoryappearance2(inputs)
});
export { settingscategoryappearance2 as "settingsCategoryAppearance" }
/**
* | output |
* | --- |
* | "Files & Windows" |
*
* @param {Settingscategoryfiles2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingscategoryfiles2 = /** @type {((inputs?: Settingscategoryfiles2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingscategoryfiles2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingscategoryfiles2(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingscategoryfiles2(inputs)
	if (locale === "en-US") return __en_us2.settingscategoryfiles2(inputs)
	return __ja_jp2.settingscategoryfiles2(inputs)
});
export { settingscategoryfiles2 as "settingsCategoryFiles" }
/**
* | output |
* | --- |
* | "Images" |
*
* @param {Settingscategoryimages2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingscategoryimages2 = /** @type {((inputs?: Settingscategoryimages2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingscategoryimages2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingscategoryimages2(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingscategoryimages2(inputs)
	if (locale === "en-US") return __en_us2.settingscategoryimages2(inputs)
	return __ja_jp2.settingscategoryimages2(inputs)
});
export { settingscategoryimages2 as "settingsCategoryImages" }
/**
* | output |
* | --- |
* | "Stats & Outline" |
*
* @param {Settingscategorystats2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingscategorystats2 = /** @type {((inputs?: Settingscategorystats2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingscategorystats2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingscategorystats2(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingscategorystats2(inputs)
	if (locale === "en-US") return __en_us2.settingscategorystats2(inputs)
	return __ja_jp2.settingscategorystats2(inputs)
});
export { settingscategorystats2 as "settingsCategoryStats" }
/**
* | output |
* | --- |
* | "Advanced" |
*
* @param {Settingscategoryadvanced2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingscategoryadvanced2 = /** @type {((inputs?: Settingscategoryadvanced2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingscategoryadvanced2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingscategoryadvanced2(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingscategoryadvanced2(inputs)
	if (locale === "en-US") return __en_us2.settingscategoryadvanced2(inputs)
	return __ja_jp2.settingscategoryadvanced2(inputs)
});
export { settingscategoryadvanced2 as "settingsCategoryAdvanced" }
/**
* | output |
* | --- |
* | "About" |
*
* @param {Settingscategoryabout2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingscategoryabout2 = /** @type {((inputs?: Settingscategoryabout2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingscategoryabout2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingscategoryabout2(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingscategoryabout2(inputs)
	if (locale === "en-US") return __en_us2.settingscategoryabout2(inputs)
	return __ja_jp2.settingscategoryabout2(inputs)
});
export { settingscategoryabout2 as "settingsCategoryAbout" }
/**
* | output |
* | --- |
* | "About Nomo" |
*
* @param {Settingscategoryabouttitle3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingscategoryabouttitle3 = /** @type {((inputs?: Settingscategoryabouttitle3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingscategoryabouttitle3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingscategoryabouttitle3(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingscategoryabouttitle3(inputs)
	if (locale === "en-US") return __en_us2.settingscategoryabouttitle3(inputs)
	return __ja_jp2.settingscategoryabouttitle3(inputs)
});
export { settingscategoryabouttitle3 as "settingsCategoryAboutTitle" }
/**
* | output |
* | --- |
* | "Interface language" |
*
* @param {Interfacelanguage1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const interfacelanguage1 = /** @type {((inputs?: Interfacelanguage1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Interfacelanguage1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.interfacelanguage1(inputs)
	if (locale === "zh-TW") return __zh_tw2.interfacelanguage1(inputs)
	if (locale === "en-US") return __en_us2.interfacelanguage1(inputs)
	return __ja_jp2.interfacelanguage1(inputs)
});
export { interfacelanguage1 as "interfaceLanguage" }
/**
* | output |
* | --- |
* | "Controls app UI, menus, and messages. It never rewrites the current Markdown document." |
*
* @param {Interfacelanguagedescription2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const interfacelanguagedescription2 = /** @type {((inputs?: Interfacelanguagedescription2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Interfacelanguagedescription2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.interfacelanguagedescription2(inputs)
	if (locale === "zh-TW") return __zh_tw2.interfacelanguagedescription2(inputs)
	if (locale === "en-US") return __en_us2.interfacelanguagedescription2(inputs)
	return __ja_jp2.interfacelanguagedescription2(inputs)
});
export { interfacelanguagedescription2 as "interfaceLanguageDescription" }
/**
* | output |
* | --- |
* | "Follow system" |
*
* @param {Interfacelanguagesystem2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const interfacelanguagesystem2 = /** @type {((inputs?: Interfacelanguagesystem2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Interfacelanguagesystem2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.interfacelanguagesystem2(inputs)
	if (locale === "zh-TW") return __zh_tw2.interfacelanguagesystem2(inputs)
	if (locale === "en-US") return __en_us2.interfacelanguagesystem2(inputs)
	return __ja_jp2.interfacelanguagesystem2(inputs)
});
export { interfacelanguagesystem2 as "interfaceLanguageSystem" }
/**
* | output |
* | --- |
* | "简体中文" |
*
* @param {Interfacelanguagezhcn3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const interfacelanguagezhcn3 = /** @type {((inputs?: Interfacelanguagezhcn3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Interfacelanguagezhcn3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.interfacelanguagezhcn3(inputs)
	if (locale === "zh-TW") return __zh_tw2.interfacelanguagezhcn3(inputs)
	if (locale === "en-US") return __en_us2.interfacelanguagezhcn3(inputs)
	return __ja_jp2.interfacelanguagezhcn3(inputs)
});
export { interfacelanguagezhcn3 as "interfaceLanguageZhCn" }
/**
* | output |
* | --- |
* | "繁體中文" |
*
* @param {Interfacelanguagezhtw3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const interfacelanguagezhtw3 = /** @type {((inputs?: Interfacelanguagezhtw3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Interfacelanguagezhtw3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.interfacelanguagezhtw3(inputs)
	if (locale === "zh-TW") return __zh_tw2.interfacelanguagezhtw3(inputs)
	if (locale === "en-US") return __en_us2.interfacelanguagezhtw3(inputs)
	return __ja_jp2.interfacelanguagezhtw3(inputs)
});
export { interfacelanguagezhtw3 as "interfaceLanguageZhTw" }
/**
* | output |
* | --- |
* | "English" |
*
* @param {Interfacelanguageenus3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const interfacelanguageenus3 = /** @type {((inputs?: Interfacelanguageenus3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Interfacelanguageenus3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.interfacelanguageenus3(inputs)
	if (locale === "zh-TW") return __zh_tw2.interfacelanguageenus3(inputs)
	if (locale === "en-US") return __en_us2.interfacelanguageenus3(inputs)
	return __ja_jp2.interfacelanguageenus3(inputs)
});
export { interfacelanguageenus3 as "interfaceLanguageEnUs" }
/**
* | output |
* | --- |
* | "Saved automatically" |
*
* @param {Settingssaved1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingssaved1 = /** @type {((inputs?: Settingssaved1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingssaved1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingssaved1(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingssaved1(inputs)
	if (locale === "en-US") return __en_us2.settingssaved1(inputs)
	return __ja_jp2.settingssaved1(inputs)
});
export { settingssaved1 as "settingsSaved" }
/**
* | output |
* | --- |
* | "Saving..." |
*
* @param {Settingssaving1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingssaving1 = /** @type {((inputs?: Settingssaving1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingssaving1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingssaving1(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingssaving1(inputs)
	if (locale === "en-US") return __en_us2.settingssaving1(inputs)
	return __ja_jp2.settingssaving1(inputs)
});
export { settingssaving1 as "settingsSaving" }
/**
* | output |
* | --- |
* | "Failed to save settings" |
*
* @param {Settingssavefailed2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingssavefailed2 = /** @type {((inputs?: Settingssavefailed2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingssavefailed2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingssavefailed2(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingssavefailed2(inputs)
	if (locale === "en-US") return __en_us2.settingssavefailed2(inputs)
	return __ja_jp2.settingssavefailed2(inputs)
});
export { settingssavefailed2 as "settingsSaveFailed" }
/**
* | output |
* | --- |
* | "Reading settings..." |
*
* @param {Settingsloading1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const settingsloading1 = /** @type {((inputs?: Settingsloading1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settingsloading1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.settingsloading1(inputs)
	if (locale === "zh-TW") return __zh_tw2.settingsloading1(inputs)
	if (locale === "en-US") return __en_us2.settingsloading1(inputs)
	return __ja_jp2.settingsloading1(inputs)
});
export { settingsloading1 as "settingsLoading" }
/**
* | output |
* | --- |
* | "Syncs to the main window and render services after saving." |
*
* @param {Themedescription1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const themedescription1 = /** @type {((inputs?: Themedescription1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Themedescription1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.themedescription1(inputs)
	if (locale === "zh-TW") return __zh_tw2.themedescription1(inputs)
	if (locale === "en-US") return __en_us2.themedescription1(inputs)
	return __ja_jp2.themedescription1(inputs)
});
export { themedescription1 as "themeDescription" }
/**
* | output |
* | --- |
* | "Light" |
*
* @param {Themelight1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const themelight1 = /** @type {((inputs?: Themelight1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Themelight1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.themelight1(inputs)
	if (locale === "zh-TW") return __zh_tw2.themelight1(inputs)
	if (locale === "en-US") return __en_us2.themelight1(inputs)
	return __ja_jp2.themelight1(inputs)
});
export { themelight1 as "themeLight" }
/**
* | output |
* | --- |
* | "Dark" |
*
* @param {Themedark1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const themedark1 = /** @type {((inputs?: Themedark1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Themedark1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.themedark1(inputs)
	if (locale === "zh-TW") return __zh_tw2.themedark1(inputs)
	if (locale === "en-US") return __en_us2.themedark1(inputs)
	return __ja_jp2.themedark1(inputs)
});
export { themedark1 as "themeDark" }
/**
* | output |
* | --- |
* | "System" |
*
* @param {Themesystem1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const themesystem1 = /** @type {((inputs?: Themesystem1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Themesystem1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.themesystem1(inputs)
	if (locale === "zh-TW") return __zh_tw2.themesystem1(inputs)
	if (locale === "en-US") return __en_us2.themesystem1(inputs)
	return __ja_jp2.themesystem1(inputs)
});
export { themesystem1 as "themeSystem" }
/**
* | output |
* | --- |
* | "Default startup edit mode" |
*
* @param {Editormodedefault2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const editormodedefault2 = /** @type {((inputs?: Editormodedefault2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Editormodedefault2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.editormodedefault2(inputs)
	if (locale === "zh-TW") return __zh_tw2.editormodedefault2(inputs)
	if (locale === "en-US") return __en_us2.editormodedefault2(inputs)
	return __ja_jp2.editormodedefault2(inputs)
});
export { editormodedefault2 as "editorModeDefault" }
/**
* | output |
* | --- |
* | "Used as the default editing mode the next time a document opens." |
*
* @param {Editormodedefaultdescription3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const editormodedefaultdescription3 = /** @type {((inputs?: Editormodedefaultdescription3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Editormodedefaultdescription3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.editormodedefaultdescription3(inputs)
	if (locale === "zh-TW") return __zh_tw2.editormodedefaultdescription3(inputs)
	if (locale === "en-US") return __en_us2.editormodedefaultdescription3(inputs)
	return __ja_jp2.editormodedefaultdescription3(inputs)
});
export { editormodedefaultdescription3 as "editorModeDefaultDescription" }
/**
* | output |
* | --- |
* | "Semantic editing" |
*
* @param {Semanticediting1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const semanticediting1 = /** @type {((inputs?: Semanticediting1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Semanticediting1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.semanticediting1(inputs)
	if (locale === "zh-TW") return __zh_tw2.semanticediting1(inputs)
	if (locale === "en-US") return __en_us2.semanticediting1(inputs)
	return __ja_jp2.semanticediting1(inputs)
});
export { semanticediting1 as "semanticEditing" }
/**
* | output |
* | --- |
* | "Source mode" |
*
* @param {Sourcemode1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const sourcemode1 = /** @type {((inputs?: Sourcemode1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sourcemode1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.sourcemode1(inputs)
	if (locale === "zh-TW") return __zh_tw2.sourcemode1(inputs)
	if (locale === "en-US") return __en_us2.sourcemode1(inputs)
	return __ja_jp2.sourcemode1(inputs)
});
export { sourcemode1 as "sourceMode" }
/**
* | output |
* | --- |
* | "Auto save" |
*
* @param {Autosave1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const autosave1 = /** @type {((inputs?: Autosave1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Autosave1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.autosave1(inputs)
	if (locale === "zh-TW") return __zh_tw2.autosave1(inputs)
	if (locale === "en-US") return __en_us2.autosave1(inputs)
	return __ja_jp2.autosave1(inputs)
});
export { autosave1 as "autoSave" }
/**
* | output |
* | --- |
* | "Automatically writes edits to the current local file." |
*
* @param {Autosavedescription2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const autosavedescription2 = /** @type {((inputs?: Autosavedescription2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Autosavedescription2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.autosavedescription2(inputs)
	if (locale === "zh-TW") return __zh_tw2.autosavedescription2(inputs)
	if (locale === "en-US") return __en_us2.autosavedescription2(inputs)
	return __ja_jp2.autosavedescription2(inputs)
});
export { autosavedescription2 as "autoSaveDescription" }
/**
* | output |
* | --- |
* | "Restore window" |
*
* @param {Restorewindow1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const restorewindow1 = /** @type {((inputs?: Restorewindow1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Restorewindow1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.restorewindow1(inputs)
	if (locale === "zh-TW") return __zh_tw2.restorewindow1(inputs)
	if (locale === "en-US") return __en_us2.restorewindow1(inputs)
	return __ja_jp2.restorewindow1(inputs)
});
export { restorewindow1 as "restoreWindow" }
/**
* | output |
* | --- |
* | "Delete" |
*
* @param {_DeleteInputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const _delete = /** @type {((inputs?: _DeleteInputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<_DeleteInputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2._delete(inputs)
	if (locale === "zh-TW") return __zh_tw2._delete(inputs)
	if (locale === "en-US") return __en_us2._delete(inputs)
	return __ja_jp2._delete(inputs)
});
export { _delete as "delete" }
/**
* | output |
* | --- |
* | "Confirm delete" |
*
* @param {Confirmdelete1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const confirmdelete1 = /** @type {((inputs?: Confirmdelete1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Confirmdelete1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.confirmdelete1(inputs)
	if (locale === "zh-TW") return __zh_tw2.confirmdelete1(inputs)
	if (locale === "en-US") return __en_us2.confirmdelete1(inputs)
	return __ja_jp2.confirmdelete1(inputs)
});
export { confirmdelete1 as "confirmDelete" }
/**
* | output |
* | --- |
* | "These files have unsaved changes: {names}. Closing the window will discard them. Continue?" |
*
* @param {Unsavedchangesclosewindow3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const unsavedchangesclosewindow3 = /** @type {((inputs: Unsavedchangesclosewindow3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Unsavedchangesclosewindow3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.unsavedchangesclosewindow3(inputs)
	if (locale === "zh-TW") return __zh_tw2.unsavedchangesclosewindow3(inputs)
	if (locale === "en-US") return __en_us2.unsavedchangesclosewindow3(inputs)
	return __ja_jp2.unsavedchangesclosewindow3(inputs)
});
export { unsavedchangesclosewindow3 as "unsavedChangesCloseWindow" }
/**
* | output |
* | --- |
* | "These files have unsaved changes: {names}. Quitting the app will discard them. Continue?" |
*
* @param {Unsavedchangesexitapp3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const unsavedchangesexitapp3 = /** @type {((inputs: Unsavedchangesexitapp3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Unsavedchangesexitapp3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.unsavedchangesexitapp3(inputs)
	if (locale === "zh-TW") return __zh_tw2.unsavedchangesexitapp3(inputs)
	if (locale === "en-US") return __en_us2.unsavedchangesexitapp3(inputs)
	return __ja_jp2.unsavedchangesexitapp3(inputs)
});
export { unsavedchangesexitapp3 as "unsavedChangesExitApp" }
/**
* | output |
* | --- |
* | "These files have unsaved changes: {names}. Closing will discard them. Continue?" |
*
* @param {Unsavedchangesclosetabs3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const unsavedchangesclosetabs3 = /** @type {((inputs: Unsavedchangesclosetabs3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Unsavedchangesclosetabs3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.unsavedchangesclosetabs3(inputs)
	if (locale === "zh-TW") return __zh_tw2.unsavedchangesclosetabs3(inputs)
	if (locale === "en-US") return __en_us2.unsavedchangesclosetabs3(inputs)
	return __ja_jp2.unsavedchangesclosetabs3(inputs)
});
export { unsavedchangesclosetabs3 as "unsavedChangesCloseTabs" }
/**
* | output |
* | --- |
* | "When closing the main window for the first time, hide Nomo to the system tray? OK: hide to tray and remember this choice. Cancel: close the window directly. ..." |
*
* @param {Closetotrayfirstprompt4Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const closetotrayfirstprompt4 = /** @type {((inputs?: Closetotrayfirstprompt4Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Closetotrayfirstprompt4Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.closetotrayfirstprompt4(inputs)
	if (locale === "zh-TW") return __zh_tw2.closetotrayfirstprompt4(inputs)
	if (locale === "en-US") return __en_us2.closetotrayfirstprompt4(inputs)
	return __ja_jp2.closetotrayfirstprompt4(inputs)
});
export { closetotrayfirstprompt4 as "closeToTrayFirstPrompt" }
/**
* | output |
* | --- |
* | "The folder does not exist or has been moved" |
*
* @param {Foldermissing1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const foldermissing1 = /** @type {((inputs?: Foldermissing1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Foldermissing1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.foldermissing1(inputs)
	if (locale === "zh-TW") return __zh_tw2.foldermissing1(inputs)
	if (locale === "en-US") return __en_us2.foldermissing1(inputs)
	return __ja_jp2.foldermissing1(inputs)
});
export { foldermissing1 as "folderMissing" }
/**
* | output |
* | --- |
* | "The file does not exist or has been moved" |
*
* @param {Filemissing1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const filemissing1 = /** @type {((inputs?: Filemissing1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Filemissing1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.filemissing1(inputs)
	if (locale === "zh-TW") return __zh_tw2.filemissing1(inputs)
	if (locale === "en-US") return __en_us2.filemissing1(inputs)
	return __ja_jp2.filemissing1(inputs)
});
export { filemissing1 as "fileMissing" }
/**
* | output |
* | --- |
* | "Failed to open preview" |
*
* @param {Previewopenfailed2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const previewopenfailed2 = /** @type {((inputs?: Previewopenfailed2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Previewopenfailed2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.previewopenfailed2(inputs)
	if (locale === "zh-TW") return __zh_tw2.previewopenfailed2(inputs)
	if (locale === "en-US") return __en_us2.previewopenfailed2(inputs)
	return __ja_jp2.previewopenfailed2(inputs)
});
export { previewopenfailed2 as "previewOpenFailed" }
/**
* | output |
* | --- |
* | "{message}; removed from Explorer" |
*
* @param {Removedfromexplorer2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const removedfromexplorer2 = /** @type {((inputs: Removedfromexplorer2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Removedfromexplorer2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.removedfromexplorer2(inputs)
	if (locale === "zh-TW") return __zh_tw2.removedfromexplorer2(inputs)
	if (locale === "en-US") return __en_us2.removedfromexplorer2(inputs)
	return __ja_jp2.removedfromexplorer2(inputs)
});
export { removedfromexplorer2 as "removedFromExplorer" }
/**
* | output |
* | --- |
* | "file" |
*
* @param {FileInputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
export const file = /** @type {((inputs?: FileInputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<FileInputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.file(inputs)
	if (locale === "zh-TW") return __zh_tw2.file(inputs)
	if (locale === "en-US") return __en_us2.file(inputs)
	return __ja_jp2.file(inputs)
});
/**
* | output |
* | --- |
* | "folder" |
*
* @param {FolderInputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
export const folder = /** @type {((inputs?: FolderInputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<FolderInputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.folder(inputs)
	if (locale === "zh-TW") return __zh_tw2.folder(inputs)
	if (locale === "en-US") return __en_us2.folder(inputs)
	return __ja_jp2.folder(inputs)
});
/**
* | output |
* | --- |
* | "Current folder" |
*
* @param {Currentfolder1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const currentfolder1 = /** @type {((inputs?: Currentfolder1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Currentfolder1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.currentfolder1(inputs)
	if (locale === "zh-TW") return __zh_tw2.currentfolder1(inputs)
	if (locale === "en-US") return __en_us2.currentfolder1(inputs)
	return __ja_jp2.currentfolder1(inputs)
});
export { currentfolder1 as "currentFolder" }
/**
* | output |
* | --- |
* | "New folder" |
*
* @param {Newfolder1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const newfolder1 = /** @type {((inputs?: Newfolder1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Newfolder1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.newfolder1(inputs)
	if (locale === "zh-TW") return __zh_tw2.newfolder1(inputs)
	if (locale === "en-US") return __en_us2.newfolder1(inputs)
	return __ja_jp2.newfolder1(inputs)
});
export { newfolder1 as "newFolder" }
/**
* | output |
* | --- |
* | "Untitled.md" |
*
* @param {Untitledmarkdown1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const untitledmarkdown1 = /** @type {((inputs?: Untitledmarkdown1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Untitledmarkdown1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.untitledmarkdown1(inputs)
	if (locale === "zh-TW") return __zh_tw2.untitledmarkdown1(inputs)
	if (locale === "en-US") return __en_us2.untitledmarkdown1(inputs)
	return __ja_jp2.untitledmarkdown1(inputs)
});
export { untitledmarkdown1 as "untitledMarkdown" }
/**
* | output |
* | --- |
* | "Deleted {type}" |
*
* @param {Deletedtype1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const deletedtype1 = /** @type {((inputs: Deletedtype1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletedtype1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.deletedtype1(inputs)
	if (locale === "zh-TW") return __zh_tw2.deletedtype1(inputs)
	if (locale === "en-US") return __en_us2.deletedtype1(inputs)
	return __ja_jp2.deletedtype1(inputs)
});
export { deletedtype1 as "deletedType" }
/**
* | output |
* | --- |
* | "Delete failed: {error}" |
*
* @param {Deletefailed1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const deletefailed1 = /** @type {((inputs: Deletefailed1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletefailed1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.deletefailed1(inputs)
	if (locale === "zh-TW") return __zh_tw2.deletefailed1(inputs)
	if (locale === "en-US") return __en_us2.deletefailed1(inputs)
	return __ja_jp2.deletefailed1(inputs)
});
export { deletefailed1 as "deleteFailed" }
/**
* | output |
* | --- |
* | "Failed to create folder: {error}" |
*
* @param {Createfolderfailed2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const createfolderfailed2 = /** @type {((inputs: Createfolderfailed2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Createfolderfailed2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.createfolderfailed2(inputs)
	if (locale === "zh-TW") return __zh_tw2.createfolderfailed2(inputs)
	if (locale === "en-US") return __en_us2.createfolderfailed2(inputs)
	return __ja_jp2.createfolderfailed2(inputs)
});
export { createfolderfailed2 as "createFolderFailed" }
/**
* | output |
* | --- |
* | "Rename failed: {error}" |
*
* @param {Renamefailed1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const renamefailed1 = /** @type {((inputs: Renamefailed1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Renamefailed1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.renamefailed1(inputs)
	if (locale === "zh-TW") return __zh_tw2.renamefailed1(inputs)
	if (locale === "en-US") return __en_us2.renamefailed1(inputs)
	return __ja_jp2.renamefailed1(inputs)
});
export { renamefailed1 as "renameFailed" }
/**
* | output |
* | --- |
* | "The current document switched to read-only source mode because it exceeds the large-file threshold" |
*
* @param {Largedocumentreadonly2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const largedocumentreadonly2 = /** @type {((inputs?: Largedocumentreadonly2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Largedocumentreadonly2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.largedocumentreadonly2(inputs)
	if (locale === "zh-TW") return __zh_tw2.largedocumentreadonly2(inputs)
	if (locale === "en-US") return __en_us2.largedocumentreadonly2(inputs)
	return __ja_jp2.largedocumentreadonly2(inputs)
});
export { largedocumentreadonly2 as "largeDocumentReadonly" }
/**
* | output |
* | --- |
* | "Failed to open sample document: {error}" |
*
* @param {Sampleopenfailed2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const sampleopenfailed2 = /** @type {((inputs: Sampleopenfailed2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sampleopenfailed2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.sampleopenfailed2(inputs)
	if (locale === "zh-TW") return __zh_tw2.sampleopenfailed2(inputs)
	if (locale === "en-US") return __en_us2.sampleopenfailed2(inputs)
	return __ja_jp2.sampleopenfailed2(inputs)
});
export { sampleopenfailed2 as "sampleOpenFailed" }
/**
* | output |
* | --- |
* | "Sample document opened" |
*
* @param {Sampleopened1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const sampleopened1 = /** @type {((inputs?: Sampleopened1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sampleopened1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.sampleopened1(inputs)
	if (locale === "zh-TW") return __zh_tw2.sampleopened1(inputs)
	if (locale === "en-US") return __en_us2.sampleopened1(inputs)
	return __ja_jp2.sampleopened1(inputs)
});
export { sampleopened1 as "sampleOpened" }
/**
* | output |
* | --- |
* | "The current document is read-only, so links cannot be edited" |
*
* @param {Readonlycannoteditlink3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const readonlycannoteditlink3 = /** @type {((inputs?: Readonlycannoteditlink3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Readonlycannoteditlink3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.readonlycannoteditlink3(inputs)
	if (locale === "zh-TW") return __zh_tw2.readonlycannoteditlink3(inputs)
	if (locale === "en-US") return __en_us2.readonlycannoteditlink3(inputs)
	return __ja_jp2.readonlycannoteditlink3(inputs)
});
export { readonlycannoteditlink3 as "readonlyCannotEditLink" }
/**
* | output |
* | --- |
* | "Switch to semantic mode before editing links" |
*
* @param {Switchsemanticbeforeeditlink4Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const switchsemanticbeforeeditlink4 = /** @type {((inputs?: Switchsemanticbeforeeditlink4Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Switchsemanticbeforeeditlink4Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.switchsemanticbeforeeditlink4(inputs)
	if (locale === "zh-TW") return __zh_tw2.switchsemanticbeforeeditlink4(inputs)
	if (locale === "en-US") return __en_us2.switchsemanticbeforeeditlink4(inputs)
	return __ja_jp2.switchsemanticbeforeeditlink4(inputs)
});
export { switchsemanticbeforeeditlink4 as "switchSemanticBeforeEditLink" }
/**
* | output |
* | --- |
* | "Opening link..." |
*
* @param {Openinglink1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const openinglink1 = /** @type {((inputs?: Openinglink1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Openinglink1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.openinglink1(inputs)
	if (locale === "zh-TW") return __zh_tw2.openinglink1(inputs)
	if (locale === "en-US") return __en_us2.openinglink1(inputs)
	return __ja_jp2.openinglink1(inputs)
});
export { openinglink1 as "openingLink" }
/**
* | output |
* | --- |
* | "Opening link" |
*
* @param {Openinglinkshort2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const openinglinkshort2 = /** @type {((inputs?: Openinglinkshort2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Openinglinkshort2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.openinglinkshort2(inputs)
	if (locale === "zh-TW") return __zh_tw2.openinglinkshort2(inputs)
	if (locale === "en-US") return __en_us2.openinglinkshort2(inputs)
	return __ja_jp2.openinglinkshort2(inputs)
});
export { openinglinkshort2 as "openingLinkShort" }
/**
* | output |
* | --- |
* | "Failed to open link: {error}" |
*
* @param {Openlinkfailed2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const openlinkfailed2 = /** @type {((inputs: Openlinkfailed2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Openlinkfailed2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.openlinkfailed2(inputs)
	if (locale === "zh-TW") return __zh_tw2.openlinkfailed2(inputs)
	if (locale === "en-US") return __en_us2.openlinkfailed2(inputs)
	return __ja_jp2.openlinkfailed2(inputs)
});
export { openlinkfailed2 as "openLinkFailed" }
/**
* | output |
* | --- |
* | "Enter a link address" |
*
* @param {Linkhrefrequired2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const linkhrefrequired2 = /** @type {((inputs?: Linkhrefrequired2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Linkhrefrequired2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.linkhrefrequired2(inputs)
	if (locale === "zh-TW") return __zh_tw2.linkhrefrequired2(inputs)
	if (locale === "en-US") return __en_us2.linkhrefrequired2(inputs)
	return __ja_jp2.linkhrefrequired2(inputs)
});
export { linkhrefrequired2 as "linkHrefRequired" }
/**
* | output |
* | --- |
* | "The link address is unavailable. Use http(s), mailto, an anchor, or a relative path." |
*
* @param {Linkhrefinvalid2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const linkhrefinvalid2 = /** @type {((inputs?: Linkhrefinvalid2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Linkhrefinvalid2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.linkhrefinvalid2(inputs)
	if (locale === "zh-TW") return __zh_tw2.linkhrefinvalid2(inputs)
	if (locale === "en-US") return __en_us2.linkhrefinvalid2(inputs)
	return __ja_jp2.linkhrefinvalid2(inputs)
});
export { linkhrefinvalid2 as "linkHrefInvalid" }
/**
* | output |
* | --- |
* | "The current selection has no link to remove" |
*
* @param {Linknothingtoremove3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const linknothingtoremove3 = /** @type {((inputs?: Linknothingtoremove3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Linknothingtoremove3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.linknothingtoremove3(inputs)
	if (locale === "zh-TW") return __zh_tw2.linknothingtoremove3(inputs)
	if (locale === "en-US") return __en_us2.linknothingtoremove3(inputs)
	return __ja_jp2.linknothingtoremove3(inputs)
});
export { linknothingtoremove3 as "linkNothingToRemove" }
/**
* | output |
* | --- |
* | "The current document is read-only, so metadata cannot be edited" |
*
* @param {Readonlycannoteditmetadata3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const readonlycannoteditmetadata3 = /** @type {((inputs?: Readonlycannoteditmetadata3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Readonlycannoteditmetadata3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.readonlycannoteditmetadata3(inputs)
	if (locale === "zh-TW") return __zh_tw2.readonlycannoteditmetadata3(inputs)
	if (locale === "en-US") return __en_us2.readonlycannoteditmetadata3(inputs)
	return __ja_jp2.readonlycannoteditmetadata3(inputs)
});
export { readonlycannoteditmetadata3 as "readonlyCannotEditMetadata" }
/**
* | output |
* | --- |
* | "The current document is read-only, so metadata cannot be deleted" |
*
* @param {Readonlycannotdeletemetadata3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const readonlycannotdeletemetadata3 = /** @type {((inputs?: Readonlycannotdeletemetadata3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Readonlycannotdeletemetadata3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.readonlycannotdeletemetadata3(inputs)
	if (locale === "zh-TW") return __zh_tw2.readonlycannotdeletemetadata3(inputs)
	if (locale === "en-US") return __en_us2.readonlycannotdeletemetadata3(inputs)
	return __ja_jp2.readonlycannotdeletemetadata3(inputs)
});
export { readonlycannotdeletemetadata3 as "readonlyCannotDeleteMetadata" }
/**
* | output |
* | --- |
* | "{featureName} is coming soon" |
*
* @param {Featurecomingsoon2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const featurecomingsoon2 = /** @type {((inputs: Featurecomingsoon2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Featurecomingsoon2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.featurecomingsoon2(inputs)
	if (locale === "zh-TW") return __zh_tw2.featurecomingsoon2(inputs)
	if (locale === "en-US") return __en_us2.featurecomingsoon2(inputs)
	return __ja_jp2.featurecomingsoon2(inputs)
});
export { featurecomingsoon2 as "featureComingSoon" }
/**
* | output |
* | --- |
* | "Zoom {percent}%" |
*
* @param {Zoomstatus1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const zoomstatus1 = /** @type {((inputs: Zoomstatus1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Zoomstatus1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.zoomstatus1(inputs)
	if (locale === "zh-TW") return __zh_tw2.zoomstatus1(inputs)
	if (locale === "en-US") return __en_us2.zoomstatus1(inputs)
	return __ja_jp2.zoomstatus1(inputs)
});
export { zoomstatus1 as "zoomStatus" }
/**
* | output |
* | --- |
* | "Deleted {removed} image files; {failed} failed" |
*
* @param {Imagecleanupremovedfailed3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const imagecleanupremovedfailed3 = /** @type {((inputs: Imagecleanupremovedfailed3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Imagecleanupremovedfailed3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.imagecleanupremovedfailed3(inputs)
	if (locale === "zh-TW") return __zh_tw2.imagecleanupremovedfailed3(inputs)
	if (locale === "en-US") return __en_us2.imagecleanupremovedfailed3(inputs)
	return __ja_jp2.imagecleanupremovedfailed3(inputs)
});
export { imagecleanupremovedfailed3 as "imageCleanupRemovedFailed" }
/**
* | output |
* | --- |
* | "Deleted {removed} image files" |
*
* @param {Imagecleanupremoved2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const imagecleanupremoved2 = /** @type {((inputs: Imagecleanupremoved2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Imagecleanupremoved2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.imagecleanupremoved2(inputs)
	if (locale === "zh-TW") return __zh_tw2.imagecleanupremoved2(inputs)
	if (locale === "en-US") return __en_us2.imagecleanupremoved2(inputs)
	return __ja_jp2.imagecleanupremoved2(inputs)
});
export { imagecleanupremoved2 as "imageCleanupRemoved" }
/**
* | output |
* | --- |
* | "{failed} image files failed to delete" |
*
* @param {Imagecleanupfailed2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const imagecleanupfailed2 = /** @type {((inputs: Imagecleanupfailed2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Imagecleanupfailed2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.imagecleanupfailed2(inputs)
	if (locale === "zh-TW") return __zh_tw2.imagecleanupfailed2(inputs)
	if (locale === "en-US") return __en_us2.imagecleanupfailed2(inputs)
	return __ja_jp2.imagecleanupfailed2(inputs)
});
export { imagecleanupfailed2 as "imageCleanupFailed" }
/**
* | output |
* | --- |
* | "Delete {type} \"{name}\"?" |
*
* @param {Confirmdeletemessage2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const confirmdeletemessage2 = /** @type {((inputs: Confirmdeletemessage2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Confirmdeletemessage2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.confirmdeletemessage2(inputs)
	if (locale === "zh-TW") return __zh_tw2.confirmdeletemessage2(inputs)
	if (locale === "en-US") return __en_us2.confirmdeletemessage2(inputs)
	return __ja_jp2.confirmdeletemessage2(inputs)
});
export { confirmdeletemessage2 as "confirmDeleteMessage" }
/**
* | output |
* | --- |
* | "External file changed" |
*
* @param {Externalfilechanged2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const externalfilechanged2 = /** @type {((inputs?: Externalfilechanged2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Externalfilechanged2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.externalfilechanged2(inputs)
	if (locale === "zh-TW") return __zh_tw2.externalfilechanged2(inputs)
	if (locale === "en-US") return __en_us2.externalfilechanged2(inputs)
	return __ja_jp2.externalfilechanged2(inputs)
});
export { externalfilechanged2 as "externalFileChanged" }
/**
* | output |
* | --- |
* | "Reload external version" |
*
* @param {Reloadexternalversion2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const reloadexternalversion2 = /** @type {((inputs?: Reloadexternalversion2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Reloadexternalversion2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.reloadexternalversion2(inputs)
	if (locale === "zh-TW") return __zh_tw2.reloadexternalversion2(inputs)
	if (locale === "en-US") return __en_us2.reloadexternalversion2(inputs)
	return __ja_jp2.reloadexternalversion2(inputs)
});
export { reloadexternalversion2 as "reloadExternalVersion" }
/**
* | output |
* | --- |
* | "Save current content as..." |
*
* @param {Saveascurrentcontent3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const saveascurrentcontent3 = /** @type {((inputs?: Saveascurrentcontent3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Saveascurrentcontent3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.saveascurrentcontent3(inputs)
	if (locale === "zh-TW") return __zh_tw2.saveascurrentcontent3(inputs)
	if (locale === "en-US") return __en_us2.saveascurrentcontent3(inputs)
	return __ja_jp2.saveascurrentcontent3(inputs)
});
export { saveascurrentcontent3 as "saveAsCurrentContent" }
/**
* | output |
* | --- |
* | "Overwrite external version" |
*
* @param {Overwriteexternalversion2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const overwriteexternalversion2 = /** @type {((inputs?: Overwriteexternalversion2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Overwriteexternalversion2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.overwriteexternalversion2(inputs)
	if (locale === "zh-TW") return __zh_tw2.overwriteexternalversion2(inputs)
	if (locale === "en-US") return __en_us2.overwriteexternalversion2(inputs)
	return __ja_jp2.overwriteexternalversion2(inputs)
});
export { overwriteexternalversion2 as "overwriteExternalVersion" }
/**
* | output |
* | --- |
* | "Markdown source" |
*
* @param {Markdownsource1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const markdownsource1 = /** @type {((inputs?: Markdownsource1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Markdownsource1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.markdownsource1(inputs)
	if (locale === "zh-TW") return __zh_tw2.markdownsource1(inputs)
	if (locale === "en-US") return __en_us2.markdownsource1(inputs)
	return __ja_jp2.markdownsource1(inputs)
});
export { markdownsource1 as "markdownSource" }
/**
* | output |
* | --- |
* | "Semantic editor" |
*
* @param {Semanticeditorarea2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const semanticeditorarea2 = /** @type {((inputs?: Semanticeditorarea2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Semanticeditorarea2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.semanticeditorarea2(inputs)
	if (locale === "zh-TW") return __zh_tw2.semanticeditorarea2(inputs)
	if (locale === "en-US") return __en_us2.semanticeditorarea2(inputs)
	return __ja_jp2.semanticeditorarea2(inputs)
});
export { semanticeditorarea2 as "semanticEditorArea" }
/**
* | output |
* | --- |
* | "Document outline" |
*
* @param {Documentoutline1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const documentoutline1 = /** @type {((inputs?: Documentoutline1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Documentoutline1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.documentoutline1(inputs)
	if (locale === "zh-TW") return __zh_tw2.documentoutline1(inputs)
	if (locale === "en-US") return __en_us2.documentoutline1(inputs)
	return __ja_jp2.documentoutline1(inputs)
});
export { documentoutline1 as "documentOutline" }
/**
* | output |
* | --- |
* | "Expand heading" |
*
* @param {Expandheading1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const expandheading1 = /** @type {((inputs?: Expandheading1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Expandheading1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.expandheading1(inputs)
	if (locale === "zh-TW") return __zh_tw2.expandheading1(inputs)
	if (locale === "en-US") return __en_us2.expandheading1(inputs)
	return __ja_jp2.expandheading1(inputs)
});
export { expandheading1 as "expandHeading" }
/**
* | output |
* | --- |
* | "Collapse heading" |
*
* @param {Collapseheading1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const collapseheading1 = /** @type {((inputs?: Collapseheading1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Collapseheading1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.collapseheading1(inputs)
	if (locale === "zh-TW") return __zh_tw2.collapseheading1(inputs)
	if (locale === "en-US") return __en_us2.collapseheading1(inputs)
	return __ja_jp2.collapseheading1(inputs)
});
export { collapseheading1 as "collapseHeading" }
/**
* | output |
* | --- |
* | "Expand {title}" |
*
* @param {Expandnamedheading2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const expandnamedheading2 = /** @type {((inputs: Expandnamedheading2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Expandnamedheading2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.expandnamedheading2(inputs)
	if (locale === "zh-TW") return __zh_tw2.expandnamedheading2(inputs)
	if (locale === "en-US") return __en_us2.expandnamedheading2(inputs)
	return __ja_jp2.expandnamedheading2(inputs)
});
export { expandnamedheading2 as "expandNamedHeading" }
/**
* | output |
* | --- |
* | "Collapse {title}" |
*
* @param {Collapsenamedheading2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const collapsenamedheading2 = /** @type {((inputs: Collapsenamedheading2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Collapsenamedheading2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.collapsenamedheading2(inputs)
	if (locale === "zh-TW") return __zh_tw2.collapsenamedheading2(inputs)
	if (locale === "en-US") return __en_us2.collapsenamedheading2(inputs)
	return __ja_jp2.collapsenamedheading2(inputs)
});
export { collapsenamedheading2 as "collapseNamedHeading" }
/**
* | output |
* | --- |
* | "This document has no headings yet" |
*
* @param {Documenthasnoheadings3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const documenthasnoheadings3 = /** @type {((inputs?: Documenthasnoheadings3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Documenthasnoheadings3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.documenthasnoheadings3(inputs)
	if (locale === "zh-TW") return __zh_tw2.documenthasnoheadings3(inputs)
	if (locale === "en-US") return __en_us2.documenthasnoheadings3(inputs)
	return __ja_jp2.documenthasnoheadings3(inputs)
});
export { documenthasnoheadings3 as "documentHasNoHeadings" }
/**
* | output |
* | --- |
* | "How should “{folderName}” open?" |
*
* @param {Folderopenquestion2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const folderopenquestion2 = /** @type {((inputs: Folderopenquestion2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Folderopenquestion2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.folderopenquestion2(inputs)
	if (locale === "zh-TW") return __zh_tw2.folderopenquestion2(inputs)
	if (locale === "en-US") return __en_us2.folderopenquestion2(inputs)
	return __ja_jp2.folderopenquestion2(inputs)
});
export { folderopenquestion2 as "folderOpenQuestion" }
/**
* | output |
* | --- |
* | "Open here" |
*
* @param {Openincurrentwindow3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const openincurrentwindow3 = /** @type {((inputs?: Openincurrentwindow3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Openincurrentwindow3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.openincurrentwindow3(inputs)
	if (locale === "zh-TW") return __zh_tw2.openincurrentwindow3(inputs)
	if (locale === "en-US") return __en_us2.openincurrentwindow3(inputs)
	return __ja_jp2.openincurrentwindow3(inputs)
});
export { openincurrentwindow3 as "openInCurrentWindow" }
/**
* | output |
* | --- |
* | "Open in new window" |
*
* @param {Openinnewwindow3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const openinnewwindow3 = /** @type {((inputs?: Openinnewwindow3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Openinnewwindow3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.openinnewwindow3(inputs)
	if (locale === "zh-TW") return __zh_tw2.openinnewwindow3(inputs)
	if (locale === "en-US") return __en_us2.openinnewwindow3(inputs)
	return __ja_jp2.openinnewwindow3(inputs)
});
export { openinnewwindow3 as "openInNewWindow" }
/**
* | output |
* | --- |
* | "Do not ask again, and remember my choice" |
*
* @param {Rememberfolderopenchoice3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const rememberfolderopenchoice3 = /** @type {((inputs?: Rememberfolderopenchoice3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Rememberfolderopenchoice3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.rememberfolderopenchoice3(inputs)
	if (locale === "zh-TW") return __zh_tw2.rememberfolderopenchoice3(inputs)
	if (locale === "en-US") return __en_us2.rememberfolderopenchoice3(inputs)
	return __ja_jp2.rememberfolderopenchoice3(inputs)
});
export { rememberfolderopenchoice3 as "rememberFolderOpenChoice" }
/**
* | output |
* | --- |
* | "Note" |
*
* @param {Calloutnote1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const calloutnote1 = /** @type {((inputs?: Calloutnote1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calloutnote1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.calloutnote1(inputs)
	if (locale === "zh-TW") return __zh_tw2.calloutnote1(inputs)
	if (locale === "en-US") return __en_us2.calloutnote1(inputs)
	return __ja_jp2.calloutnote1(inputs)
});
export { calloutnote1 as "calloutNote" }
/**
* | output |
* | --- |
* | "Tip" |
*
* @param {Callouttip1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const callouttip1 = /** @type {((inputs?: Callouttip1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Callouttip1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.callouttip1(inputs)
	if (locale === "zh-TW") return __zh_tw2.callouttip1(inputs)
	if (locale === "en-US") return __en_us2.callouttip1(inputs)
	return __ja_jp2.callouttip1(inputs)
});
export { callouttip1 as "calloutTip" }
/**
* | output |
* | --- |
* | "Important" |
*
* @param {Calloutimportant1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const calloutimportant1 = /** @type {((inputs?: Calloutimportant1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calloutimportant1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.calloutimportant1(inputs)
	if (locale === "zh-TW") return __zh_tw2.calloutimportant1(inputs)
	if (locale === "en-US") return __en_us2.calloutimportant1(inputs)
	return __ja_jp2.calloutimportant1(inputs)
});
export { calloutimportant1 as "calloutImportant" }
/**
* | output |
* | --- |
* | "Warning" |
*
* @param {Calloutwarning1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const calloutwarning1 = /** @type {((inputs?: Calloutwarning1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calloutwarning1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.calloutwarning1(inputs)
	if (locale === "zh-TW") return __zh_tw2.calloutwarning1(inputs)
	if (locale === "en-US") return __en_us2.calloutwarning1(inputs)
	return __ja_jp2.calloutwarning1(inputs)
});
export { calloutwarning1 as "calloutWarning" }
/**
* | output |
* | --- |
* | "Caution" |
*
* @param {Calloutcaution1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const calloutcaution1 = /** @type {((inputs?: Calloutcaution1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calloutcaution1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.calloutcaution1(inputs)
	if (locale === "zh-TW") return __zh_tw2.calloutcaution1(inputs)
	if (locale === "en-US") return __en_us2.calloutcaution1(inputs)
	return __ja_jp2.calloutcaution1(inputs)
});
export { calloutcaution1 as "calloutCaution" }
/**
* | output |
* | --- |
* | "Confirm metadata deletion" |
*
* @param {Confirmdeletemetadata2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const confirmdeletemetadata2 = /** @type {((inputs?: Confirmdeletemetadata2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Confirmdeletemetadata2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.confirmdeletemetadata2(inputs)
	if (locale === "zh-TW") return __zh_tw2.confirmdeletemetadata2(inputs)
	if (locale === "en-US") return __en_us2.confirmdeletemetadata2(inputs)
	return __ja_jp2.confirmdeletemetadata2(inputs)
});
export { confirmdeletemetadata2 as "confirmDeleteMetadata" }
/**
* | output |
* | --- |
* | "Delete metadata" |
*
* @param {Deletemetadata1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const deletemetadata1 = /** @type {((inputs?: Deletemetadata1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletemetadata1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.deletemetadata1(inputs)
	if (locale === "zh-TW") return __zh_tw2.deletemetadata1(inputs)
	if (locale === "en-US") return __en_us2.deletemetadata1(inputs)
	return __ja_jp2.deletemetadata1(inputs)
});
export { deletemetadata1 as "deleteMetadata" }
/**
* | output |
* | --- |
* | "Document metadata" |
*
* @param {Documentmetadata1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const documentmetadata1 = /** @type {((inputs?: Documentmetadata1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Documentmetadata1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.documentmetadata1(inputs)
	if (locale === "zh-TW") return __zh_tw2.documentmetadata1(inputs)
	if (locale === "en-US") return __en_us2.documentmetadata1(inputs)
	return __ja_jp2.documentmetadata1(inputs)
});
export { documentmetadata1 as "documentMetadata" }
/**
* | output |
* | --- |
* | "Document metadata edit mode" |
*
* @param {Documentmetadataediting2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const documentmetadataediting2 = /** @type {((inputs?: Documentmetadataediting2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Documentmetadataediting2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.documentmetadataediting2(inputs)
	if (locale === "zh-TW") return __zh_tw2.documentmetadataediting2(inputs)
	if (locale === "en-US") return __en_us2.documentmetadataediting2(inputs)
	return __ja_jp2.documentmetadataediting2(inputs)
});
export { documentmetadataediting2 as "documentMetadataEditing" }
/**
* | output |
* | --- |
* | "Edit document metadata content" |
*
* @param {Editdocumentmetadatacontent3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const editdocumentmetadatacontent3 = /** @type {((inputs?: Editdocumentmetadatacontent3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Editdocumentmetadatacontent3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.editdocumentmetadatacontent3(inputs)
	if (locale === "zh-TW") return __zh_tw2.editdocumentmetadatacontent3(inputs)
	if (locale === "en-US") return __en_us2.editdocumentmetadatacontent3(inputs)
	return __ja_jp2.editdocumentmetadatacontent3(inputs)
});
export { editdocumentmetadatacontent3 as "editDocumentMetadataContent" }
/**
* | output |
* | --- |
* | "View document metadata" |
*
* @param {Viewdocumentmetadata2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const viewdocumentmetadata2 = /** @type {((inputs?: Viewdocumentmetadata2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Viewdocumentmetadata2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.viewdocumentmetadata2(inputs)
	if (locale === "zh-TW") return __zh_tw2.viewdocumentmetadata2(inputs)
	if (locale === "en-US") return __en_us2.viewdocumentmetadata2(inputs)
	return __ja_jp2.viewdocumentmetadata2(inputs)
});
export { viewdocumentmetadata2 as "viewDocumentMetadata" }
/**
* | output |
* | --- |
* | "Edit document metadata" |
*
* @param {Editdocumentmetadata2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const editdocumentmetadata2 = /** @type {((inputs?: Editdocumentmetadata2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Editdocumentmetadata2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.editdocumentmetadata2(inputs)
	if (locale === "zh-TW") return __zh_tw2.editdocumentmetadata2(inputs)
	if (locale === "en-US") return __en_us2.editdocumentmetadata2(inputs)
	return __ja_jp2.editdocumentmetadata2(inputs)
});
export { editdocumentmetadata2 as "editDocumentMetadata" }
/**
* | output |
* | --- |
* | "Created {date}" |
*
* @param {Metadatacreated1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const metadatacreated1 = /** @type {((inputs: Metadatacreated1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Metadatacreated1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.metadatacreated1(inputs)
	if (locale === "zh-TW") return __zh_tw2.metadatacreated1(inputs)
	if (locale === "en-US") return __en_us2.metadatacreated1(inputs)
	return __ja_jp2.metadatacreated1(inputs)
});
export { metadatacreated1 as "metadataCreated" }
/**
* | output |
* | --- |
* | "Updated {date}" |
*
* @param {Metadataupdated1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const metadataupdated1 = /** @type {((inputs: Metadataupdated1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Metadataupdated1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.metadataupdated1(inputs)
	if (locale === "zh-TW") return __zh_tw2.metadataupdated1(inputs)
	if (locale === "en-US") return __en_us2.metadataupdated1(inputs)
	return __ja_jp2.metadataupdated1(inputs)
});
export { metadataupdated1 as "metadataUpdated" }
/**
* | output |
* | --- |
* | "{count} more metadata fields" |
*
* @param {Metadatamorefields2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const metadatamorefields2 = /** @type {((inputs: Metadatamorefields2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Metadatamorefields2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.metadatamorefields2(inputs)
	if (locale === "zh-TW") return __zh_tw2.metadatamorefields2(inputs)
	if (locale === "en-US") return __en_us2.metadatamorefields2(inputs)
	return __ja_jp2.metadatamorefields2(inputs)
});
export { metadatamorefields2 as "metadataMoreFields" }
/**
* | output |
* | --- |
* | "Edit link" |
*
* @param {Editlink1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const editlink1 = /** @type {((inputs?: Editlink1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Editlink1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.editlink1(inputs)
	if (locale === "zh-TW") return __zh_tw2.editlink1(inputs)
	if (locale === "en-US") return __en_us2.editlink1(inputs)
	return __ja_jp2.editlink1(inputs)
});
export { editlink1 as "editLink" }
/**
* | output |
* | --- |
* | "Title (display text)" |
*
* @param {Linktitleplaceholder2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const linktitleplaceholder2 = /** @type {((inputs?: Linktitleplaceholder2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Linktitleplaceholder2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.linktitleplaceholder2(inputs)
	if (locale === "zh-TW") return __zh_tw2.linktitleplaceholder2(inputs)
	if (locale === "en-US") return __en_us2.linktitleplaceholder2(inputs)
	return __ja_jp2.linktitleplaceholder2(inputs)
});
export { linktitleplaceholder2 as "linkTitlePlaceholder" }
/**
* | output |
* | --- |
* | "Title" |
*
* @param {Linktitle1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const linktitle1 = /** @type {((inputs?: Linktitle1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Linktitle1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.linktitle1(inputs)
	if (locale === "zh-TW") return __zh_tw2.linktitle1(inputs)
	if (locale === "en-US") return __en_us2.linktitle1(inputs)
	return __ja_jp2.linktitle1(inputs)
});
export { linktitle1 as "linkTitle" }
/**
* | output |
* | --- |
* | "Link address" |
*
* @param {Linkhref1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const linkhref1 = /** @type {((inputs?: Linkhref1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Linkhref1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.linkhref1(inputs)
	if (locale === "zh-TW") return __zh_tw2.linkhref1(inputs)
	if (locale === "en-US") return __en_us2.linkhref1(inputs)
	return __ja_jp2.linkhref1(inputs)
});
export { linkhref1 as "linkHref" }
/**
* | output |
* | --- |
* | "Apply link" |
*
* @param {Applylink1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const applylink1 = /** @type {((inputs?: Applylink1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Applylink1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.applylink1(inputs)
	if (locale === "zh-TW") return __zh_tw2.applylink1(inputs)
	if (locale === "en-US") return __en_us2.applylink1(inputs)
	return __ja_jp2.applylink1(inputs)
});
export { applylink1 as "applyLink" }
/**
* | output |
* | --- |
* | "Remove link" |
*
* @param {Removelink1Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const removelink1 = /** @type {((inputs?: Removelink1Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Removelink1Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.removelink1(inputs)
	if (locale === "zh-TW") return __zh_tw2.removelink1(inputs)
	if (locale === "en-US") return __en_us2.removelink1(inputs)
	return __ja_jp2.removelink1(inputs)
});
export { removelink1 as "removeLink" }
/**
* | output |
* | --- |
* | "Close link editor" |
*
* @param {Closelinkeditor2Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const closelinkeditor2 = /** @type {((inputs?: Closelinkeditor2Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Closelinkeditor2Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.closelinkeditor2(inputs)
	if (locale === "zh-TW") return __zh_tw2.closelinkeditor2(inputs)
	if (locale === "en-US") return __en_us2.closelinkeditor2(inputs)
	return __ja_jp2.closelinkeditor2(inputs)
});
export { closelinkeditor2 as "closeLinkEditor" }
/**
* | output |
* | --- |
* | "Japanese" |
*
* @param {Interfacelanguagejajp3Inputs} inputs
* @param {{ locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }} options
* @returns {LocalizedString}
*/
const interfacelanguagejajp3 = /** @type {((inputs?: Interfacelanguagejajp3Inputs, options?: { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Interfacelanguagejajp3Inputs, { locale?: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "zh-CN") return __zh_cn2.interfacelanguagejajp3(inputs)
	if (locale === "zh-TW") return __zh_tw2.interfacelanguagejajp3(inputs)
	if (locale === "en-US") return __en_us2.interfacelanguagejajp3(inputs)
	return __ja_jp2.interfacelanguagejajp3(inputs)
});
export { interfacelanguagejajp3 as "interfaceLanguageJaJp" }