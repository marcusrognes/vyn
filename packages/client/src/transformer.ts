export type Transformer = {
	serialize:   (value: unknown) => unknown;
	deserialize: (value: unknown) => unknown;
};

export const identityTransformer: Transformer = {
	serialize:   (v) => v,
	deserialize: (v) => v,
};
