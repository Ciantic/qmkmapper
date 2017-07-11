import { keycode, modifierkeytype } from "../QMK/keycodes";
import { keycodeToUsbcode, isKeycode } from "../QMK";
import { KeycapText } from "../Components/Key";
import { LANGS } from "../Langs";
import { QmkFunctionResult, isModResult, isModLikeResult } from "../QMK/functions";
import { ReferenceKeyboardKey } from "../ReferenceKeyboards/index";

export type keytypes = "normal" | "shifted" | "altgr" | "altgrshifted";

interface LanguageCsvFormat {
    usbcode: number;

    // Symbols produced
    normal: string;
    shifted: string;
    altgr: string;
    altgrshifted: string;

    deadkeys: string; // deadkeys separated by space, e.g. "normal shifted"

    // Presentation on keycap
    bottomleft: string; // normal
    topleft: string; // shifted
    bottomright: string; // altgr
    topright: string; // altgrshifted
    centerleft: string; // Not used normally
    centered: string; // command keys, e.g. Delete
    centerright: string; // Not used normally

    // Name (if differs from keycap presentation)
    name: string;
}

interface LanguageMappingOpts {
    lang: string;
    name: string;
    referenceKeyboard: ReferenceKeyboardKey;
    mapping: LanguageCsvFormat[];
}

export interface ILanguageMapping {
    lang: string;
    name: string;
    referenceKeyboard: ReferenceKeyboardKey;
    getKeycapTextFromUsbcode(usbcode: number): KeycapText;
    renderExpr(expr: QmkFunctionResult): QmkFunctionResult | null;
}

export class LanguageMapping implements ILanguageMapping {
    public readonly lang: string;
    public readonly name: string;
    public readonly referenceKeyboard: ReferenceKeyboardKey;
    protected readonly mapping: Map<number, LanguageCsvFormat>;

    constructor(opts: LanguageMappingOpts) {
        this.lang = opts.lang;
        this.name = opts.name;
        this.mapping = new Map();
        this.referenceKeyboard = opts.referenceKeyboard;
        opts.mapping.forEach(t => {
            this.mapping.set(+t.usbcode, t);
        });
    }

    // This can be overridden in some really weird mappings by inheriting from
    // this class
    public getKeycapTextFromUsbcode = (usbcode: number): KeycapText | null => {
        if (this.mapping.has(usbcode)) {
            let m = this.mapping.get(usbcode);
            if (
                m.bottomleft ||
                m.topleft ||
                m.bottomright ||
                m.topright ||
                m.centerleft ||
                m.centered ||
                m.centerright
            ) {
                return m;
            }
            return {
                bottomleft: m.normal,
                topleft: m.shifted,
                bottomright: m.altgr,
                topright: m.altgrshifted,
            };
        }
        return null;
    };

    public renderExpr = (expr: QmkFunctionResult | string): QmkFunctionResult => {
        if (isKeycode(expr)) {
            let usbcode = keycodeToUsbcode(expr);
            if (usbcode !== null) {
                return {
                    type: "keycode",
                    keycode: expr,
                    rendered: this.getKeycapTextFromUsbcode(usbcode),
                };
            }
        } else if (isModResult(expr)) {
            let usbcode = keycodeToUsbcode(expr.keycode);
            if (usbcode === null) {
                return expr;
            }

            // Normal symbol with modifiers
            let sym = this.getSymbolWithModifiers(expr.mods, usbcode);
            if (sym) {
                expr.rendered = {
                    centered: sym,
                };
                return expr;
            }

            // Only modifiers
            if (expr.keycode === "KC_NO") {
                expr.rendered = {
                    centered: expr.modifierText,
                };
                return expr;
            }

            // Key with modifiers, e.g. Ctrl+E
            let nsym = this.getSymbol("normal", usbcode) || this.getCenteredText(usbcode);
            expr.rendered = {
                centered: (nsym && nsym.toUpperCase()) || expr.keycode,
                bottomcenter: expr.modifierText,
            };
            return expr;
        } else if (isModLikeResult(expr)) {
            let usbcode = keycodeToUsbcode(expr.keycode);
            let sym = this.getSymbol("normal", usbcode) || this.getCenteredText(usbcode);

            // Symbol and modifier below
            if (sym) {
                expr.rendered = {
                    centered: sym && sym.toUpperCase(),
                    bottomcenter: expr.modifierText,
                };
                return expr;
            }

            // Only the modifier
            if (expr.keycode === "KC_NO") {
                expr.rendered = {
                    centered: expr.modifierText,
                };
                return expr;
            }

            // Fallback on showing modifier below
            expr.rendered = {
                centered: expr.keycode,
                bottomcenter: expr.modifierText,
            };
            return expr;
        }
        return expr;
    };

    protected getSymbolWithModifiers = (
        mods: modifierkeytype[],
        usbcode: number
    ): string | null => {
        if (mods.length === 1) {
            // Shifted symbol in CSV
            if (mods[0] === "KC_LSHIFT" || mods[0] === "KC_RSHIFT") {
                return this.getSymbol("shifted", usbcode);
            }

            // Altgr symbol in CSV
            if (mods[0] === "KC_RALT") {
                return this.getSymbol("altgr", usbcode);
            }
        } else if (mods.length === 2) {
            // Altgrshifted symbol in CSV
            if (
                mods.indexOf("KC_RALT") !== -1 &&
                (mods.indexOf("KC_LSHIFT") !== -1 || mods.indexOf("KC_RSHIFT") !== -1)
            ) {
                return this.getSymbol("altgrshifted", usbcode);
            }
        }
        return null;
    };

    protected getSymbol = (key: keytypes, usbcode: number): string | undefined => {
        let val = this.mapping.get(usbcode);
        if (val) {
            return val[key];
        }
    };
    protected getCenteredText = (usbcode: number): string | undefined => {
        let val = this.mapping.get(usbcode);
        if (val) {
            return val["centered"];
        }
    };
}

const languageMappingIndex = {
    uk: new LanguageMapping({
        lang: "EN-GB",
        mapping: require("./Data/uk.csv"),
        name: LANGS.UkKeyboard,
        referenceKeyboard: "iso105",
    }),
    fi: new LanguageMapping({
        lang: "FI",
        mapping: require("./Data/fi.csv"),
        name: LANGS.FinnishStandardKeyboard,
        referenceKeyboard: "iso105",
    }),
};

export const languageMappings: { [k: string]: ILanguageMapping } = languageMappingIndex;

export type LanguageMappingKey = keyof typeof languageMappingIndex;
