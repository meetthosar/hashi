import { Test, TestingModule } from '@nestjs/testing';
import { AssetConfig, CreateAssetDto } from './transaction.acfg.controller';
import { TransactionService } from './transaction.service';
import { ConfigService } from '@nestjs/config';
import { AlgorandTransactionCrafter } from '@algorandfoundation/algo-models';
import createMockInstance from 'jest-create-mock-instance';

describe('AssetConfig Controller', () => {
    let controller: AssetConfig;
    let transactionServiceMock: jest.Mocked<TransactionService>;
    let configServiceMock: jest.Mocked<ConfigService>;
    let crafterFactoryMock: jest.Mocked<AlgorandTransactionCrafter>;

    beforeEach(async () => {
        transactionServiceMock = createMockInstance(TransactionService);
        configServiceMock = createMockInstance(ConfigService);
        crafterFactoryMock = createMockInstance(AlgorandTransactionCrafter);

        // Setup default config service mocks
        configServiceMock.get.mockImplementation((key: string) => {
            switch (key) {
                case 'GENESIS_ID':
                    return 'testnet-v1.0';
                case 'GENESIS_HASH':
                    return 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=';
                case 'ALGORAND_NETWORK':
                    return 'testnet';
                default:
                    return undefined;
            }
        });

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AssetConfig],
            providers: [
                {
                    provide: TransactionService,
                    useValue: transactionServiceMock,
                },
                {
                    provide: ConfigService,
                    useValue: configServiceMock,
                },
                {
                    provide: AlgorandTransactionCrafter,
                    useValue: crafterFactoryMock,
                },
            ],
        }).compile();

        controller = module.get<AssetConfig>(AssetConfig);
        
        // Override the crafterFactory instance that gets created in constructor
        (controller as any).crafterFactory = crafterFactoryMock;
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with config-driven genesis values', () => {
            configServiceMock.get.mockReturnValueOnce('testnet-v1.0');
            configServiceMock.get.mockReturnValueOnce('SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=');

            const newController = new AssetConfig(
                transactionServiceMock,
                crafterFactoryMock,
                configServiceMock
            );

            expect(configServiceMock.get).toHaveBeenCalledWith('GENESIS_ID');
            expect(configServiceMock.get).toHaveBeenCalledWith('GENESIS_HASH');
        });
    });

    describe('assetConfig', () => {
        const mockSuggestedParams = {
            firstValid: 1000,
            lastValid: 2000,
            fee: 1000,
            minFee: 1000,
            genesisHash: new Uint8Array(Buffer.from('SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=', 'base64')),
            genesisID: 'testnet-v1.0',
        } as any;

        const mockCreateAssetDto: CreateAssetDto = {
            from: 'test-wallet-key',
            unit: 'TEST',
            decimals: 6,
            totalTokens: 1000000,
            assetName: 'Test Asset',
            url: 'https://test.com',
            defaultFrozen: false,
            managerAddress: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
            reserveAddress: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
            freezeAddress: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
            clawbackAddress: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
            assetId: 12345,
        };

        const mockPublicKey = 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M';
        const mockEncodedTxn = new Uint8Array([1, 2, 3, 4, 5]);
        const mockTxnId = 'MOCK_TXN_ID';
        const mockAssetId = 98765;

        beforeEach(() => {
            // Setup common mocks
            transactionServiceMock.getSuggestedParams.mockResolvedValue(mockSuggestedParams);
            transactionServiceMock.get_public_key.mockResolvedValue(mockPublicKey);
            transactionServiceMock.signAndSubmitTransaction.mockResolvedValue(mockTxnId);
            configServiceMock.get.mockReturnValue('testnet');

            // Mock the crafter chain
            const mockAssetBuilder = {
                addFirstValidRound: jest.fn().mockReturnThis(),
                addLastValidRound: jest.fn().mockReturnThis(),
                get: jest.fn().mockReturnValue({
                    encode: jest.fn().mockReturnValue(mockEncodedTxn),
                }),
            };

            crafterFactoryMock.createAsset = jest.fn().mockReturnValue(mockAssetBuilder);

            // Mock algorand client and transaction waiting
            const mockAlgorand = {
                client: {
                    indexer: {
                        lookupTransactionByID: jest.fn().mockReturnValue({
                            do: jest.fn().mockResolvedValue({
                                transaction: {
                                    createdAssetIndex: mockAssetId,
                                },
                            }),
                        }),
                    },
                },
            };

            transactionServiceMock.algorand.mockReturnValue(mockAlgorand as any);
            transactionServiceMock.waitForTransaction.mockResolvedValue({
                transaction: {
                    createdAssetIndex: mockAssetId,
                },
            } as any);
        });

        it('(OK) should create asset successfully with all parameters', async () => {
            const result = await controller.assetConfig(mockCreateAssetDto);

            expect(result).toEqual({
                assetId: mockAssetId.toString(),
                txnId: mockTxnId,
                error: null,
            });

            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.get_public_key).toHaveBeenCalledWith({
                from: mockCreateAssetDto.from,
            });
            expect(crafterFactoryMock.createAsset).toHaveBeenCalledWith(
                mockPublicKey,
                expect.any(Object)
            );
            expect(transactionServiceMock.signAndSubmitTransaction).toHaveBeenCalledWith(
                mockEncodedTxn,
                mockCreateAssetDto.from
            );
        });

        it('(OK) should create asset with minimal required parameters', async () => {
            const minimalDto: CreateAssetDto = {
                from: 'test-wallet-key',
                unit: 'MIN',
                decimals: 0,
                totalTokens: 100,
                assetId: 0,
                url: 'https://minimal.com',
                // Add valid addresses to avoid validation errors
                managerAddress: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
                reserveAddress: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
                freezeAddress: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
                clawbackAddress: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
            };

            const result = await controller.assetConfig(minimalDto);

            expect(result).toEqual({
                assetId: mockAssetId.toString(),
                txnId: mockTxnId,
                error: null,
            });

            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.get_public_key).toHaveBeenCalledWith({
                from: minimalDto.from,
            });
        });

        it('(OK) should handle decimals = 0 (falsy value)', async () => {
            const dtoWithZeroDecimals = {
                ...mockCreateAssetDto,
                decimals: 0,
            };

            const result = await controller.assetConfig(dtoWithZeroDecimals);

            expect(result).toEqual({
                assetId: mockAssetId.toString(),
                txnId: mockTxnId,
                error: null,
            });

            // Should still work even with decimals = 0
            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
        });

        it('(OK) should handle defaultFrozen = false (falsy value)', async () => {
            const dtoWithFalseFrozen = {
                ...mockCreateAssetDto,
                defaultFrozen: false,
            };

            const result = await controller.assetConfig(dtoWithFalseFrozen);

            expect(result).toEqual({
                assetId: mockAssetId.toString(),
                txnId: mockTxnId,
                error: null,
            });

            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
        });

        it('(OK) should handle string boolean conversion for defaultFrozen', async () => {
            const dtoWithStringBoolean = {
                ...mockCreateAssetDto,
                defaultFrozen: 'true' as any,
            };

            const result = await controller.assetConfig(dtoWithStringBoolean);

            expect(result).toEqual({
                assetId: mockAssetId.toString(),
                txnId: mockTxnId,
                error: null,
            });
        });

        it('(OK) should fallback to params.assetId when createdAssetIndex is null', async () => {
            // Mock transaction with null createdAssetIndex
            transactionServiceMock.waitForTransaction.mockResolvedValue({
                transaction: {
                    createdAssetIndex: null,
                },
            } as any);

            const result = await controller.assetConfig(mockCreateAssetDto);

            expect(result).toEqual({
                assetId: mockCreateAssetDto.assetId,
                txnId: mockTxnId,
                error: null,
            });
        });

        it('(FAIL) should handle getSuggestedParams error', async () => {
            const errorMessage = 'Failed to get suggested params';
            transactionServiceMock.getSuggestedParams.mockRejectedValue(new Error(errorMessage));

            await expect(controller.assetConfig(mockCreateAssetDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.get_public_key).not.toHaveBeenCalled();
        });

        it('(FAIL) should handle get_public_key error', async () => {
            const errorMessage = 'Failed to get public key';
            transactionServiceMock.get_public_key.mockRejectedValue(new Error(errorMessage));

            await expect(controller.assetConfig(mockCreateAssetDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(crafterFactoryMock.createAsset).not.toHaveBeenCalled();
        });

        it('(FAIL) should handle transaction encoding error', async () => {
            const errorMessage = 'Failed to encode transaction';
            const mockAssetBuilder = {
                addFirstValidRound: jest.fn().mockReturnThis(),
                addLastValidRound: jest.fn().mockReturnThis(),
                get: jest.fn().mockReturnValue({
                    encode: jest.fn().mockImplementation(() => {
                        throw new Error(errorMessage);
                    }),
                }),
            };

            crafterFactoryMock.createAsset.mockReturnValue(mockAssetBuilder as any);

            await expect(controller.assetConfig(mockCreateAssetDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(crafterFactoryMock.createAsset).toHaveBeenCalledTimes(1);
        });

        it('(FAIL) should handle signAndSubmitTransaction error', async () => {
            const errorMessage = 'Failed to sign and submit transaction';
            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(new Error(errorMessage));

            await expect(controller.assetConfig(mockCreateAssetDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.signAndSubmitTransaction).toHaveBeenCalledWith(
                mockEncodedTxn,
                mockCreateAssetDto.from
            );
        });

        it('(FAIL) should handle waitForTransaction error', async () => {
            const errorMessage = 'Transaction confirmation timeout';
            transactionServiceMock.waitForTransaction.mockRejectedValue(new Error(errorMessage));

            await expect(controller.assetConfig(mockCreateAssetDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.waitForTransaction).toHaveBeenCalledWith(
                mockTxnId,
                10,
                2000,
                expect.any(Object)
            );
        });

        it('(FAIL) should handle error with response structure', async () => {
            const errorWithResponse = {
                response: {
                    data: {
                        message: 'API Error Message',
                    },
                },
                message: 'Generic Error Message',
            };

            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(errorWithResponse);

            await expect(controller.assetConfig(mockCreateAssetDto)).rejects.toThrow('API Error Message');
        });

        it('(FAIL) should handle error without response structure', async () => {
            const simpleError = new Error('Simple error message');
            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(simpleError);

            await expect(controller.assetConfig(mockCreateAssetDto)).rejects.toThrow('Simple error message');
        });

        it('(FAIL) should handle unknown error type', async () => {
            const unknownError = 'String error';
            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(unknownError);

            await expect(controller.assetConfig(mockCreateAssetDto)).rejects.toThrow('Unknown error creating asset');
        });

        it('should use config service for network configuration', async () => {
            configServiceMock.get.mockReturnValue('mainnet');

            await controller.assetConfig(mockCreateAssetDto);

            expect(configServiceMock.get).toHaveBeenCalledWith('ALGORAND_NETWORK');
            expect(transactionServiceMock.algorand).toHaveBeenCalledWith('mainnet');
        });

        it('should properly convert numeric strings to numbers', async () => {
            const dtoWithStringNumbers = {
                ...mockCreateAssetDto,
                decimals: '8' as any,
                totalTokens: '5000000' as any,
                assetId: '99999' as any,
            };

            const result = await controller.assetConfig(dtoWithStringNumbers);

            expect(result).toEqual({
                assetId: mockAssetId.toString(),
                txnId: mockTxnId,
                error: null,
            });

            // Verify that numbers were properly converted
            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
        });
    });
});
