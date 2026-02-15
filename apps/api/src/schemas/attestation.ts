import { z } from '@hono/zod-openapi'

export const CreateAttestationSchema = z.object({
    statementFideIds: z.array(z.string())
        .openapi({
            example: ['did:fide:0x00abc123...'],
            description: 'Array of derived statement Fide IDs to attest'
        }),
    method: z.enum(['ed25519', 'eip712', 'eip191'])
        .openapi({
            default: 'ed25519',
            example: 'ed25519',
            description: 'Cryptographic signing method'
        }),
    caip10User: z.string()
        .openapi({
            example: 'ed25519::DYw8jCTfwHNRJhNrHSAYnfZ5JzAhMQZZmxu4pvPJYjqJ',
            description: 'CAIP-10 formatted signer address'
        }),
    privateKey: z.string().optional()
        .openapi({
            example: '0xabc123...',
            description: 'Private key for signing (Hex string, 0x-prefixed for Ethereum)'
        })
}).openapi('CreateAttestationRequest')

export const AttestationResponseSchema = z.object({
    attestationFideId: z.string().openapi({
        example: 'did:fide:0x00attestation123...',
        description: 'The Fide ID of the created attestation'
    }),
    merkleRoot: z.string().openapi({
        example: '0x1234567890abcdef...',
        description: 'Merkle tree root hash'
    }),
    signature: z.string().openapi({
        example: '0xabcdef1234567890...',
        description: 'Cryptographic signature'
    })
}).openapi('AttestationResponse')
