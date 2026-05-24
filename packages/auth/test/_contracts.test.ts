import { describe, it } from "vyn:test";

describe.todo(
	"hashPassword — produces a verifiable, salted hash (scrypt by default)",
);
describe.todo(
	"verifyPassword — true on correct, false on wrong, timing-safe compare",
);
describe.todo("randomToken — 32 bytes, hex-encoded, cryptographically random");
describe.todo(
	"createMemorySessionStore — get/set/delete sessions; expiry-honoring",
);
describe.todo(
	"SessionStore interface — implementable by apps for custom storage",
);
