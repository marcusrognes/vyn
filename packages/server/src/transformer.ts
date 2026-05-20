// Wire transformer interface. SuperJSON-shaped: serialize a value to
// a transport payload, deserialize on the other side. Apps can plug
// in SuperJSON itself, devalue, or a custom format.

export type Transformer = {
	serialize:   (value: unknown) => unknown;
	deserialize: (value: unknown) => unknown;
};

// Identity transformer: JSON-compatible values only. Use for hello-
// world apps where you don't need Date / Map / Set round-tripping.
export const identityTransformer: Transformer = {
	serialize:   (v) => v,
	deserialize: (v) => v,
};
