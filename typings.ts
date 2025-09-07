export type TScalar = string | null | number | boolean;

export type TVector = string[] | number[] | boolean[];

export type TSerial = TScalar | TSerial[] | { [key: string]: TSerial };

export type NonEmpty<T> = [T, ...T[]];
