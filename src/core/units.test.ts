import { describe, expect, it } from "vitest";
import { UNIT_GROUPS, findUnit, unitsFor } from "./units";

describe("findUnit", () => {
    it('returns undefined for a missing quantity or the "none" quantity', () => {
        expect(findUnit(undefined, "m")).toBeUndefined();
        expect(findUnit("none", "m")).toBeUndefined();
    });

    it("returns undefined for a unit the quantity does not offer", () => {
        expect(findUnit("length", "kg")).toBeUndefined();
    });

    it("round-trips every unit in every group without drift", () => {
        for (const [quantity, units] of Object.entries(UNIT_GROUPS)) {
            for (const unit of units) {
                const roundTripped = unit.fromBase(unit.toBase(42));
                expect(
                    roundTripped,
                    `${quantity}/${unit.id} failed to round-trip`,
                ).toBeCloseTo(42, 6);
            }
        }
    });

    it("keeps an identity-converting unit as the base of every group", () => {
        // The base unit is identified by its identity conversion, not by its
        // position: angle deliberately lists degrees first because that is the
        // civil engineering default, even though radians are the SI base.
        const expectedBase: Record<string, string> = {
            length: "m",
            area: "m2",
            volume: "m3",
            mass: "kg",
            force: "N",
            pressure: "Pa",
            density: "kgm3",
            unitWeight: "Nm3",
            flow: "m3s",
            velocity: "ms",
            time: "s",
            angle: "rad",
            temperature: "C",
            money: "unit",
        };

        for (const [quantity, units] of Object.entries(UNIT_GROUPS)) {
            const base = units.filter(
                (u) => u.toBase(1) === 1 && u.fromBase(1) === 1,
            );
            expect(
                base.length,
                `${quantity} should have exactly one base unit`,
            ).toBe(1);
            expect(base[0].id, `${quantity} has the wrong base unit`).toBe(
                expectedBase[quantity],
            );
        }
    });

    it("offers degrees before radians so engineering inputs default sensibly", () => {
        expect(UNIT_GROUPS.angle[0].id).toBe("deg");
    });
});

describe("length conversions", () => {
    const m = (v: number) => findUnit("length", "m")!.toBase(v);

    it("converts millimetres to metres", () => {
        const mm = findUnit("length", "mm")!;
        expect(mm.toBase(1000)).toBeCloseTo(1, 10);
        expect(mm.fromBase(1)).toBeCloseTo(1000, 10);
    });

    it("converts feet to metres using the exact definition", () => {
        // 1 ft is defined as exactly 0.3048 m.
        expect(findUnit("length", "ft")!.toBase(1)).toBeCloseTo(0.3048, 10);
        expect(findUnit("length", "ft")!.toBase(10)).toBeCloseTo(3.048, 10);
    });

    it("converts inches to metres using the exact definition", () => {
        expect(findUnit("length", "in")!.toBase(12)).toBeCloseTo(0.3048, 10);
    });

    it("treats a metre as the base unit", () => {
        const metre = findUnit("length", "m")!;
        expect(metre.toBase(7.5)).toBe(7.5);
        expect(metre.fromBase(7.5)).toBe(7.5);
    });

    it("keeps km, cm and yd consistent with m", () => {
        expect(findUnit("length", "km")!.toBase(1)).toBeCloseTo(1000, 10);
        expect(findUnit("length", "cm")!.toBase(100)).toBeCloseTo(1, 10);
        expect(findUnit("length", "yd")!.toBase(1)).toBeCloseTo(0.9144, 10);
        expect(m(1)).toBe(1);
    });
});

describe("area and volume conversions", () => {
    it("converts a hectare using the exact value", () => {
        expect(findUnit("area", "ha")!.toBase(1)).toBeCloseTo(10000, 6);
    });

    it("converts an acre using the exact value", () => {
        expect(findUnit("area", "acre")!.toBase(1)).toBeCloseTo(
            4046.8564224,
            6,
        );
    });

    it("relates square feet to square metres through the length factor", () => {
        // 1 ft² must equal 0.3048² m².
        expect(findUnit("area", "ft2")!.toBase(1)).toBeCloseTo(0.3048 ** 2, 10);
    });

    it("converts litres and cubic feet to cubic metres", () => {
        expect(findUnit("volume", "L")!.toBase(1000)).toBeCloseTo(1, 10);
        expect(findUnit("volume", "ft3")!.toBase(1)).toBeCloseTo(
            0.3048 ** 3,
            10,
        );
    });

    it("relates the US and UK gallon correctly", () => {
        const us = findUnit("volume", "galUS")!.toBase(1);
        const uk = findUnit("volume", "galUK")!.toBase(1);
        // The imperial gallon is about 20% larger than the US gallon.
        expect(uk / us).toBeCloseTo(1.2009, 3);
    });
});

describe("mass and force conversions", () => {
    it("treats a tonne as 1000 kg", () => {
        expect(findUnit("mass", "t")!.toBase(1)).toBe(1000);
    });

    it("converts pounds using the exact definition", () => {
        expect(findUnit("mass", "lb")!.toBase(1)).toBeCloseTo(0.45359237, 10);
    });

    it("converts kgf using standard gravity", () => {
        expect(findUnit("force", "kgf")!.toBase(1)).toBeCloseTo(9.80665, 6);
    });

    it("relates a kip to 1000 lbf", () => {
        const lbf = findUnit("force", "lbf")!.toBase(1);
        const kip = findUnit("force", "kip")!.toBase(1);
        expect(kip / lbf).toBeCloseTo(1000, 6);
    });

    it("relates N/mm² to MPa, since 1 N/mm² is exactly 1 MPa", () => {
        expect(findUnit("pressure", "Nmm2")!.toBase(1)).toBeCloseTo(1e6, 6);
        expect(findUnit("pressure", "MPa")!.toBase(1)).toBeCloseTo(1e6, 6);
    });

    it("converts psi within 0.1% of 6894.757 Pa", () => {
        expect(findUnit("pressure", "psi")!.toBase(1)).toBeCloseTo(6894.757, 3);
    });
});

describe("temperature, an affine scale", () => {
    const toC = (id: string, v: number) =>
        findUnit("temperature", id)!.toBase(v);
    const fromC = (id: string, v: number) =>
        findUnit("temperature", id)!.fromBase(v);

    it("keeps Celsius as the base", () => {
        expect(toC("C", 25)).toBe(25);
    });

    it("converts the freezing and boiling points of water", () => {
        expect(toC("F", 32)).toBeCloseTo(0, 10);
        expect(toC("F", 212)).toBeCloseTo(100, 10);
        expect(toC("K", 273.15)).toBeCloseTo(0, 10);
    });

    it("handles negative Fahrenheit values", () => {
        expect(toC("F", -40)).toBeCloseTo(-40, 10);
    });

    it("round-trips Fahrenheit and Kelvin", () => {
        expect(fromC("F", toC("F", 98.6))).toBeCloseTo(98.6, 10);
        expect(fromC("K", toC("K", 300))).toBeCloseTo(300, 10);
    });
});

describe("unitsFor", () => {
    it("returns nothing for a field without a quantity", () => {
        expect(unitsFor({})).toEqual([]);
        expect(unitsFor({ quantity: "none" })).toEqual([]);
    });

    it("returns the whole group when no restriction is given", () => {
        expect(unitsFor({ quantity: "length" }).length).toBe(
            UNIT_GROUPS.length.length,
        );
    });

    it("honours allowedUnits and preserves the group order", () => {
        const limited = unitsFor({
            quantity: "length",
            allowedUnits: ["mm", "m"],
        });
        expect(limited.map((u) => u.id)).toEqual(["m", "mm"]);
    });

    it("ignores allowedUnits entries that the group does not define", () => {
        const limited = unitsFor({
            quantity: "length",
            allowedUnits: ["m", "kg"],
        });
        expect(limited.map((u) => u.id)).toEqual(["m"]);
    });
});
