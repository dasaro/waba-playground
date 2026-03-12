/**
 * @typedef {Object} RunConfig
 * @property {string} semiringFamily
 * @property {'higher'|'lower'} polarity
 * @property {'neutral'} defaultPolicy
 * @property {'sum'|'max'|'count'|'min'} monoid
 * @property {'minimize'|'maximize'} optimization
 * @property {'none'|'ub'|'lb'} budgetMode
 * @property {'explore'|'no_discard'|'bounded'} budgetIntent
 * @property {'cf'|'stable'|'admissible'|'complete'|'grounded'|'preferred'} semantics
 * @property {'ignore'|'optN'} optMode
 * @property {number} beta
 * @property {number} numModels
 * @property {number} timeout
 * @property {'standard'|'projection'} filterType
 *
 * @typedef {RunConfig & {
 *   semiringKey: string,
 *   aliasLabel: string | null
 * }} EffectiveConfig
 *
 * @typedef {Object} ExamplePreset
 * @property {string} label
 * @property {string} description
 * @property {'curated'|'demos'} section
 * @property {'module'|'inline'} source
 * @property {string=} moduleKey
 * @property {string=} code
 * @property {RunConfig} preset
 *
 * @typedef {Object} ParsedExtension
 * @property {string[]} in
 * @property {string[]} out
 * @property {string[]} supported
 * @property {Map<string, string | number>} weights
 * @property {string[]} discarded
 * @property {string[]} successful
 * @property {string | number | null} budgetValue
 * @property {string | number | null} budgetValueRaw
 *
 * @typedef {Object} RankedExtension
 * @property {any} witness
 * @property {ParsedExtension} parsed
 * @property {string | number | null} cost
 * @property {string | number} aggregateValue
 * @property {number[]} objectiveTuple
 *
 * @typedef {Object} AnalysisSummary
 * @property {Array<Record<string, unknown>>} extensionLevels
 * @property {Array<Record<string, unknown>>} assumptionRanking
 *
 * @typedef {Object} DomRegistry
 * @property {Document} document
 * @property {HTMLElement} body
 * @property {HTMLTextAreaElement} editor
 * @property {HTMLElement} output
 * @property {HTMLElement} stats
 * @property {HTMLButtonElement} runBtn
 * @property {HTMLButtonElement} clearBtn
 * @property {HTMLSelectElement} semiringSelect
 * @property {HTMLSelectElement} defaultPolicySelect
 * @property {HTMLSelectElement} monoidSelect
 * @property {HTMLSelectElement} semanticsSelect
 * @property {HTMLSelectElement} exampleSelect
 * @property {HTMLInputElement} budgetInput
 * @property {HTMLElement | null} budgetInputLabel
 * @property {HTMLInputElement} numModelsInput
 * @property {HTMLElement | null} numModelsContainer
 * @property {HTMLInputElement} timeoutInput
 * @property {HTMLSelectElement} optimizeSelect
 * @property {HTMLSelectElement} optModeSelect
 * @property {HTMLSelectElement} constraintSelect
 * @property {HTMLSelectElement} polaritySelect
 * @property {HTMLSelectElement} budgetIntentSelect
 * @property {HTMLElement} semiringAliasNote
 * @property {HTMLElement} supportedSurfaceNote
 * @property {HTMLElement} budgetIntentNote
 * @property {HTMLInputElement[]} graphModeRadios
 * @property {HTMLSelectElement} inputMode
 * @property {HTMLElement} simpleMode
 * @property {HTMLTextAreaElement} rulesInput
 * @property {HTMLTextAreaElement} assumptionsInput
 * @property {HTMLTextAreaElement} contrariesInput
 * @property {HTMLTextAreaElement} weightsInput
 * @property {HTMLButtonElement} fileUploadBtn
 * @property {HTMLInputElement} fileUploadInput
 * @property {HTMLElement} graphCanvas
 * @property {HTMLButtonElement} resetLayoutBtn
 * @property {HTMLButtonElement} fullscreenBtn
 * @property {HTMLElement | null} graphPanel
 * @property {HTMLButtonElement} syntaxGuideBtn
 * @property {HTMLElement} syntaxGuideModal
 * @property {HTMLButtonElement} syntaxGuideClose
 * @property {HTMLButtonElement} downloadLpBtn
 * @property {HTMLButtonElement} downloadWabaBtn
 * @property {HTMLButtonElement} legendToggleBtn
 * @property {HTMLElement} graphLegend
 * @property {HTMLButtonElement} exportPngBtn
 * @property {HTMLButtonElement} exportPdfBtn
 * @property {HTMLButtonElement} themeToggleBtn
 * @property {HTMLElement} themeIcon
 * @property {HTMLButtonElement} fontIncreaseBtn
 * @property {HTMLButtonElement} fontDecreaseBtn
 * @property {HTMLElement | null} analysisPanel
 * @property {HTMLElement} exportSection
 * @property {HTMLElement | null} graphEmptyState
 * @property {HTMLElement | null} outputEmptyState
 * @property {HTMLElement | null} introStatus
 * @property {HTMLElement | null} loadingOverlay
 * @property {HTMLElement | null} loadingText
 * @property {HTMLElement | null} loadingSubtext
 * @property {HTMLElement | null} loadingElapsed
 * @property {HTMLElement | null} simpleDescriptionBox
 * @property {HTMLTextAreaElement | null} simpleDescriptionContent
 * @property {HTMLElement | null} simpleAddCommentBtn
 * @property {HTMLElement | null} simpleAddCommentContainer
 * @property {HTMLElement | null} simpleRemoveDescriptionBtn
 * @property {HTMLElement | null} isolatedAssumptionsBanner
 * @property {HTMLElement | null} isolatedAssumptionsList
 * @property {HTMLElement[]} panelToggles
 * @property {HTMLElement[]} docTabs
 * @property {HTMLElement[]} docTabContents
 * @property {(panelId: string) => HTMLElement | null} getPanel
 */

export {};
