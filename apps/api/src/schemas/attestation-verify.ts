import { z } from '@hono/zod-openapi';

const HexOrBase64KeySchema = z
  .string()
  .min(1)
  .openapi({
    example: '0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    description: 'For ed25519 only: raw 32-byte public key in 0x-hex or base64.',
  });

const AddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .openapi({
    example: '0x1234567890abcdef1234567890abcdef12345678',
    description: 'EVM address for eip712/eip191 verification.',
  });

export const AttestationVerifyRequestSchema = z
  .object({
    statementFideId: z.string().openapi({
      example: 'did:fide:0x0012345678901234567890123456789012345678',
      description: 'Statement Fide ID to verify as a leaf.',
    }),
    proof: z
      .array(
        z.object({
          hash: z.string().min(1).openapi({
            example: '5278508e42f65b08ad7259f4b7709f02a5f645fa3ad4db328f4f0887acde5f40',
            description: 'Sibling hash at this Merkle level.',
          }),
          position: z.enum(['left', 'right']).openapi({
            example: 'left',
            description: 'Sibling position relative to current hash.',
          }),
        })
      )
      .openapi({
        description: 'Merkle proof path for statement inclusion.',
      }),
    attestationData: z
      .object({
        m: z.enum(['ed25519', 'eip712', 'eip191']),
        u: z.string(),
        r: z.string(),
        s: z.string(),
      })
      .openapi({
        description: 'Attestation payload containing method/user/root/signature.',
      }),
    method: z.enum(['ed25519', 'eip712', 'eip191']).openapi({
      description: 'Signing method to use for verification.',
      example: 'ed25519',
    }),
    publicKeyOrAddress: z.union([HexOrBase64KeySchema, AddressSchema]).openapi({
      description: 'Public key (ed25519) or signer address (eip712/eip191).',
    }),
  })
  .openapi('AttestationVerifyRequest');

export const AttestationVerifyResponseSchema = z
  .object({
    valid: z.boolean().openapi({
      example: true,
      description: 'True when both Merkle proof and signature verification pass.',
    }),
  })
  .openapi('AttestationVerifyResponse');

export const AttestationVerifyErrorCodeSchema = z.enum([
  'INVALID_METHOD',
  'INVALID_PUBLIC_KEY',
  'INVALID_ADDRESS',
  'INVALID_PROOF',
  'INVALID_ATTESTATION_DATA',
]);

export const AttestationVerifyErrorResponseSchema = z.object({
  error: z.string(),
  code: AttestationVerifyErrorCodeSchema,
});
