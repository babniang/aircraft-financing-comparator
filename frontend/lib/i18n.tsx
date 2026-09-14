"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Lang = "en" | "fr";

type Dict = Record<string, string>;

const EN: Dict = {
  "banner.eyebrow": "Debt Capital Markets / Aircraft Finance",
  "banner.title": "Aircraft Financing Structure Comparator",
  "banner.lead":
    "The implied all-in annual cost of four structures a debt-structuring desk actually originates: ECA-backed debt, a sustainability-linked loan, a Japanese tax lease (JOLCO), and a sale-and-leaseback. Balance-sheet treatment, credit metrics and an optional engine-risk adjustment are shown alongside.",

  "nav.method": "Methodology",
  "nav.gtf": "Engine risk",
  "nav.author": "About",

  "inputs.heading": "Inputs",
  "inputs.aircraftType": "Aircraft type",
  "inputs.deliveryPrice": "Delivery price ($m)",
  "inputs.marketValue": "Market value ($m)",
  "inputs.tenor": "Tenor (years)",
  "inputs.gtfLabel": "GTF-exposed engine",
  "inputs.gtfHint": "adds margin and a value haircut",
  "inputs.liveData": "Live data",
  "inputs.useLiveSofr": "Use live SOFR",
  "inputs.sofrSuffix": "{rate}%, NY Fed",
  "inputs.referenceRate": "Reference rate, % base",
  "inputs.editableAssumption": "editable assumption",
  "inputs.compare": "Compare structures",
  "inputs.comparing": "Comparing",
  "inputs.gtfExposedTag": "GTF-exposed",

  "results.heading": "Results",
  "results.baseRate": "Base rate {rate}%",
  "results.sourceLive": "live SOFR",
  "results.sourceOverride": "your assumption",
  "results.sourceDefault": "default assumption",
  "results.gtfOn": "engine-risk adjustment on",
  "results.impliedAnnualCost": "Implied annual cost",
  "results.cheapest": "Lowest all-in cost",
  "results.viewCashflow": "View cash flow",
  "results.hideCashflow": "Hide cash flow",
  "results.year": "Year",
  "results.cashflow": "Cash flow ($m)",
  "results.cashflowNote":
    "Incremental versus paying the full delivery price in cash at year 0.",

  "structure.eca_debt": "ECA-Backed Term Loan",
  "structure.sll": "Sustainability-Linked Loan",
  "structure.jolco": "JOLCO (Japanese Tax Lease)",
  "structure.slb": "Sale-and-Leaseback",
  "note.eca_debt":
    "Lowest margin, but needs export-credit-agency eligibility (buyer credit, country cover). The guarantee premium is spread across the tenor.",
  "note.sll":
    "No agency fee, but a higher base margin. The rate flexes with a sustainability KPI; the base case assumes the target is met.",
  "note.jolco":
    "Cheapest all-in: Japanese tax-equity investors rebate accelerated depreciation into the rentals. But rigid, a fixed call year, limited prepayment, JPY/USD basis and heavy documentation. The airline exercises the call and keeps the aircraft.",
  "note.slb":
    "100% financed and off balance sheet, with a one-off gain or loss on disposal. The real cost is the residual value handed back at lease end.",

  "cm.title": "Credit metrics",
  "cm.ltvInitial": "Initial LTV",
  "cm.ltvMidlife": "LTV at mid-life",
  "cm.dscr": "Asset DSCR",
  "cm.wal": "WAL (yrs)",
  "cm.balloon": "Balloon",
  "cm.note":
    "Aircraft-level proxies (the tool has no airline financials). LTV is against market value; mid-life uses a straight-line depreciation curve. Asset DSCR is the airframe's lease-earning power over the annual financing outflow. Balloon is the share of the financed amount due as a lump at maturity or the JOLCO call.",

  "badge.onBalance": "On balance sheet",
  "badge.offBalance": "Off balance sheet",
  "badge.financed": "{pct}% financed",
  "badge.gain": "Gain on sale ${amt}m",
  "badge.loss": "Loss on sale ${amt}m",
  "badge.residual": "Residual given up ${amt}m",

  "export.heading": "Full working model",
  "export.body":
    "Excel workbook: assumptions, an amortisation schedule per structure, and a comparison tab. Built with live formulas (PMT, IRR, NPV), so every input stays editable in Excel.",
  "export.download": "Download Excel model",
  "export.preparing": "Preparing",

  "gtf.heading": "What the engine-risk adjustment reflects",
  "gtf.p1":
    "GTF is the Pratt & Whitney Geared Turbofan (PW1000G), the engine on much of the A320neo family, the A220 and the Embraer E2. In 2023 its maker disclosed a powder-metal manufacturing flaw: contamination in the metal used for high-pressure turbine and compressor discs can seed micro-cracks and cut the parts' safe life.",
  "gtf.p2":
    "That triggered an accelerated inspection and removal campaign running into 2026. Several hundred aircraft have been grounded at a time, shop-visit turnaround has stretched past 250 to 300 days, and the manufacturer has taken multi-billion-dollar charges to compensate operators.",
  "gtf.p3":
    "For a financing, that means lower availability, higher maintenance reserves and a softer resale bid on GTF-powered metal. The adjustment here adds a margin premium to the debt structures and a haircut to the sale price and residual value in the sale-and-leaseback.",

  "method.heading": "Methodology and assumptions",
  "method.metric":
    "The comparator runs an IRR over each structure's incremental cash flows relative to paying the full delivery price in cash at year 0. Because that baseline is common to all three, the implied annual costs are directly comparable even though the structures finance different percentages of the aircraft.",
  "method.liveHeading": "Genuinely live data",
  "method.liveBody":
    "SOFR (Federal Reserve Bank of New York), €STR (ECB Data Portal), AF.PA share price and EUR/USD (Yahoo public feed, unofficial, labelled as such). Live SOFR flows into the model when the toggle is on.",
  "method.sourcedHeading": "Sourced desk assumptions (editable, not live)",
  "method.sourced1":
    "ECA guarantee fee. OECD ASU-style premium conventions. Default 4.5% of loan, spread over the tenor for the headline figure.",
  "method.sourced2":
    "SLL base margin and KPI ratchet. Indicative bank margins. Base case assumes the KPI is met (favourable ratchet).",
  "method.sourced3":
    "SLB lease rate factor. IBA and Cirium monthly ranges. Flat annuity, whereas a real deal steps down.",
  "method.sourced4":
    "Engine-risk margin add-on and value haircut. Derived from the GTF powder-metal disclosures. See docs/methodology.md.",
  "method.notModelledHeading": "Deliberately not modelled",
  "method.notModelledBody":
    "Real-time airline credit spreads, actual bank cost of funds, actual ECA fee schedules and live margin quotes are not public data. The tool models the mechanics correctly with clearly sourced illustrative assumptions rather than manufacture false precision.",
  "method.refData": "Reference data version {version}. {note}",

  "loading.market": "Loading live market context.",
  "loading.inputs": "Loading inputs.",
  "market.live": "Live",
  "market.asOf": "as of {date}",
  "market.cached": "cached",

  "error.missingInputs": "Enter a delivery price, market value, and tenor.",
  "error.missingInputsExport":
    "Enter a delivery price, market value, and tenor first.",
  "error.waking": "Model is waking up. Tap Compare again in a few seconds.",
  "error.generic": "Something went wrong. Try again.",
  "error.tryAgain": "Try again",

  "footer.builtBy": "Built by",
  "footer.resume": "Resume",
  "footer.source": "Source code",
  "footer.disclaimer":
    "Indicative model for structure comparison. Not a valuation and not investment advice. Source, tests and methodology are in the repository.",

  "lang.switch": "FR",
  "lang.current": "EN",

  "inputs.groupAfklm": "Air France-KLM group fleet",
  "inputs.groupOther": "Other financed types",
  "inputs.priceHint": "Acquisition cost of the aircraft.",
  "inputs.valueHint": "Current market value of the airframe.",

  "table.structure": "Structure",
  "table.impliedCost": "Implied cost",
  "table.financed": "Financed",
  "table.balanceSheet": "Balance sheet",
  "table.oneOff": "One-off P&L",
  "table.residual": "Residual given up",
  "table.on": "On",
  "table.off": "Off",
  "table.cashTitle": "Incremental cash flow by year ($m)",
  "table.year": "Year",
  "table.irr": "Implied annual cost (IRR)",
  "table.cashNote":
    "Each column is the structure's cash flow minus paying the full delivery price in cash at year 0. Outflows in parentheses.",
  "table.na": "n/a",
};

const FR: Dict = {
  "banner.eyebrow": "Marchés de Dette / Financement Aéronautique",
  "banner.title": "Comparateur de Structures de Financement d'Avions",
  "banner.lead":
    "Le coût annuel implicite tout compris de quatre structures qu'un desk de structuration de dette met réellement en place : dette garantie par une agence de crédit export, prêt indexé sur la durabilité, crédit-bail fiscal japonais (JOLCO) et cession-bail. Le traitement au bilan, les métriques de crédit et un ajustement optionnel lié au risque moteur sont affichés en regard.",

  "nav.method": "Méthodologie",
  "nav.gtf": "Risque moteur",
  "nav.author": "À propos",

  "inputs.heading": "Paramètres",
  "inputs.aircraftType": "Type d'avion",
  "inputs.deliveryPrice": "Prix de livraison ($m)",
  "inputs.marketValue": "Valeur de marché ($m)",
  "inputs.tenor": "Durée (années)",
  "inputs.gtfLabel": "Moteur GTF concerné",
  "inputs.gtfHint": "ajoute une marge et une décote de valeur",
  "inputs.liveData": "Données en direct",
  "inputs.useLiveSofr": "Utiliser le SOFR en direct",
  "inputs.sofrSuffix": "{rate}%, Fed de New York",
  "inputs.referenceRate": "Taux de référence, base en %",
  "inputs.editableAssumption": "hypothèse modifiable",
  "inputs.compare": "Comparer les structures",
  "inputs.comparing": "Calcul en cours",
  "inputs.gtfExposedTag": "GTF concerné",

  "results.heading": "Résultats",
  "results.baseRate": "Taux de base {rate}%",
  "results.sourceLive": "SOFR en direct",
  "results.sourceOverride": "votre hypothèse",
  "results.sourceDefault": "hypothèse par défaut",
  "results.gtfOn": "ajustement risque moteur activé",
  "results.impliedAnnualCost": "Coût annuel implicite",
  "results.cheapest": "Coût total le plus bas",
  "results.viewCashflow": "Voir les flux de trésorerie",
  "results.hideCashflow": "Masquer les flux de trésorerie",
  "results.year": "Année",
  "results.cashflow": "Flux ($m)",
  "results.cashflowNote":
    "Différentiel par rapport à un paiement comptant intégral du prix de livraison en année 0.",

  "structure.eca_debt": "Prêt à terme garanti ECA",
  "structure.sll": "Prêt indexé sur la durabilité",
  "structure.jolco": "JOLCO (crédit-bail fiscal japonais)",
  "structure.slb": "Cession-bail",
  "note.eca_debt":
    "Marge la plus faible, mais exige l'éligibilité auprès d'une agence de crédit export (crédit acheteur, couverture pays). La prime de garantie est étalée sur la durée.",
  "note.sll":
    "Pas de commission d'agence, mais une marge de base plus élevée. Le taux varie selon un indicateur de durabilité ; le cas de base suppose l'objectif atteint.",
  "note.jolco":
    "Le moins cher tout compris : les investisseurs fiscaux japonais reversent l'amortissement accéléré dans les loyers. Mais rigide : année de call fixe, remboursement anticipé limité, base JPY/USD et documentation lourde. La compagnie exerce le call et conserve l'avion.",
  "note.slb":
    "Financé à 100% et hors bilan, avec une plus ou moins-value ponctuelle de cession. Le coût réel est la valeur résiduelle restituée en fin de bail.",

  "cm.title": "Métriques de crédit",
  "cm.ltvInitial": "LTV initiale",
  "cm.ltvMidlife": "LTV à mi-vie",
  "cm.dscr": "DSCR actif",
  "cm.wal": "Durée de vie moyenne (ans)",
  "cm.balloon": "Balloon",
  "cm.note":
    "Approximations au niveau de l'avion (l'outil n'a pas les comptes de la compagnie). La LTV est rapportée à la valeur de marché ; à mi-vie elle utilise une dépréciation linéaire. Le DSCR actif rapporte la capacité locative de la cellule au décaissement annuel de financement. Le balloon est la part du montant financé due en une fois à l'échéance ou au call JOLCO.",

  "badge.onBalance": "Au bilan",
  "badge.offBalance": "Hors bilan",
  "badge.financed": "{pct}% financé",
  "badge.gain": "Plus-value de cession ${amt}m",
  "badge.loss": "Moins-value de cession ${amt}m",
  "badge.residual": "Valeur résiduelle abandonnée ${amt}m",

  "export.heading": "Modèle complet",
  "export.body":
    "Classeur Excel : hypothèses, un échéancier d'amortissement par structure et un onglet de comparaison. Conçu avec des formules vivantes (PMT, TRI, VAN), donc chaque paramètre reste modifiable dans Excel.",
  "export.download": "Télécharger le modèle Excel",
  "export.preparing": "Préparation",

  "gtf.heading": "Ce que reflète l'ajustement lié au risque moteur",
  "gtf.p1":
    "Le GTF est le Geared Turbofan de Pratt & Whitney (PW1000G), le moteur d'une large partie de la famille A320neo, de l'A220 et de l'Embraer E2. En 2023, son constructeur a révélé un défaut de fabrication lié à la métallurgie des poudres : une contamination du métal des disques de turbine et de compresseur haute pression peut amorcer des micro-fissures et réduire la durée de vie sûre des pièces.",
  "gtf.p2":
    "Cela a déclenché une campagne accélérée d'inspections et de déposes qui court jusqu'en 2026. Plusieurs centaines d'avions ont été immobilisés simultanément, les délais d'atelier dépassent 250 à 300 jours, et le constructeur a passé des provisions de plusieurs milliards de dollars pour indemniser les opérateurs.",
  "gtf.p3":
    "Pour un financement, cela signifie une disponibilité moindre, des réserves de maintenance plus élevées et une valeur de revente affaiblie pour les appareils équipés de GTF. L'ajustement ajoute ici une prime de marge aux structures de dette et une décote sur le prix de vente et la valeur résiduelle dans la cession-bail.",

  "method.heading": "Méthodologie et hypothèses",
  "method.metric":
    "Le comparateur calcule un TRI sur les flux différentiels de chaque structure par rapport à un paiement comptant intégral du prix de livraison en année 0. Cette référence étant commune aux trois, les coûts annuels implicites sont directement comparables même si les structures financent des pourcentages différents de l'avion.",
  "method.liveHeading": "Données réellement en direct",
  "method.liveBody":
    "SOFR (Federal Reserve Bank of New York), €STR (portail de données de la BCE), cours AF.PA et EUR/USD (flux public Yahoo, non officiel, signalé comme tel). Le SOFR en direct alimente le modèle lorsque l'option est activée.",
  "method.sourcedHeading": "Hypothèses de desk sourcées (modifiables, non en direct)",
  "method.sourced1":
    "Commission de garantie ECA. Conventions de prime de type ASU de l'OCDE. Par défaut 4,5% du prêt, étalée sur la durée pour le chiffre principal.",
  "method.sourced2":
    "Marge de base et cliquet KPI du SLL. Marges bancaires indicatives. Le cas de base suppose le KPI atteint (cliquet favorable).",
  "method.sourced3":
    "Facteur de loyer de la cession-bail. Fourchettes mensuelles IBA et Cirium. Annuité constante, alors qu'une opération réelle est dégressive.",
  "method.sourced4":
    "Prime de marge et décote de valeur liées au risque moteur. Dérivées des révélations sur la métallurgie des poudres du GTF. Voir docs/methodology.md.",
  "method.notModelledHeading": "Délibérément non modélisé",
  "method.notModelledBody":
    "Les spreads de crédit des compagnies en temps réel, le coût de financement réel des banques, les barèmes de commissions ECA réels et les cotations de marge vivantes ne sont pas des données publiques. L'outil modélise correctement les mécanismes avec des hypothèses illustratives clairement sourcées plutôt que de fabriquer une fausse précision.",
  "method.refData": "Données de référence version {version}. {note}",

  "loading.market": "Chargement du contexte de marché.",
  "loading.inputs": "Chargement des paramètres.",
  "market.live": "Direct",
  "market.asOf": "au {date}",
  "market.cached": "en cache",

  "error.missingInputs": "Saisissez un prix de livraison, une valeur de marché et une durée.",
  "error.missingInputsExport":
    "Saisissez d'abord un prix de livraison, une valeur de marché et une durée.",
  "error.waking":
    "Le modèle redémarre. Touchez de nouveau Comparer dans quelques secondes.",
  "error.generic": "Une erreur est survenue. Réessayez.",
  "error.tryAgain": "Réessayer",

  "footer.builtBy": "Réalisé par",
  "footer.resume": "CV",
  "footer.source": "Code source",
  "footer.disclaimer":
    "Modèle indicatif de comparaison de structures. Ni une valorisation ni un conseil en investissement. Source, tests et méthodologie dans le dépôt.",

  "lang.switch": "EN",
  "lang.current": "FR",

  "inputs.groupAfklm": "Flotte du groupe Air France-KLM",
  "inputs.groupOther": "Autres types financés",
  "inputs.priceHint": "Coût d'acquisition de l'avion.",
  "inputs.valueHint": "Valeur de marché actuelle de la cellule.",

  "table.structure": "Structure",
  "table.impliedCost": "Coût implicite",
  "table.financed": "Financé",
  "table.balanceSheet": "Bilan",
  "table.oneOff": "Résultat ponctuel",
  "table.residual": "Valeur résiduelle abandonnée",
  "table.on": "Oui",
  "table.off": "Non",
  "table.cashTitle": "Flux de trésorerie différentiel par année ($m)",
  "table.year": "Année",
  "table.irr": "Coût annuel implicite (TRI)",
  "table.cashNote":
    "Chaque colonne correspond au flux de la structure moins le paiement comptant intégral du prix de livraison en année 0. Décaissements entre parenthèses.",
  "table.na": "n/d",
};

const DICTS: Record<Lang, Dict> = { en: EN, fr: FR };

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}

type TKey = keyof typeof EN;

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey | (string & {}), vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const STORAGE_KEY = "afsc.lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "fr") setLangState(saved);
    } catch {
      /* private mode, ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback<I18nValue["t"]>(
    (key, vars) => {
      const k = key as string;
      const dict = DICTS[lang];
      const raw = dict[k] ?? (EN as Dict)[k] ?? k;
      return interpolate(raw, vars);
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside LanguageProvider");
  return ctx;
}
