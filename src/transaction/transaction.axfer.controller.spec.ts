import { Test, TestingModule } from '@nestjs/testing';
import { AssetTransfer } from './transaction.axfer.controller';
import { TransactionService } from './transaction.service';
import { ConfigService } from '@nestjs/config';
import { AlgorandTransactionCrafter } from '@algorandfoundation/algo-models';
import createMockInstance from 'jest-create-mock-instance';

describe('AssetTransfer Controller', () => {
    let controller: AssetTransfer;
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
            controllers: [AssetTransfer],
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

        controller = module.get<AssetTransfer>(AssetTransfer);
        
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

            const newController = new AssetTransfer(
                transactionServiceMock,
                configServiceMock,
                crafterFactoryMock
            );

            expect(configServiceMock.get).toHaveBeenCalledWith('GENESIS_ID');
            expect(configServiceMock.get).toHaveBeenCalledWith('GENESIS_HASH');
        });
    });

    describe('assetTransfer', () => {
        const mockSuggestedParams = {
            firstValid: 1000,
            lastValid: 2000,
            fee: 1000,
            minFee: 1000,
            genesisHash: new Uint8Array(Buffer.from('SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=', 'base64')),
            genesisID: 'testnet-v1.0',
        } as any;

        const mockAssetTransferDto = {
            assetId: 12345,
            from: 'test-wallet-key',
            to: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
            amount: 1000,
        };

        const mockPublicKey = 'SENDER_ADDRESS_C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M';
        const mockEncodedTxn = new Uint8Array([1, 2, 3, 4, 5]);
        const mockTxnId = 'MOCK_ASSET_TRANSFER_TXN_ID';

        beforeEach(() => {
            // Setup common mocks
            transactionServiceMock.getSuggestedParams.mockResolvedValue(mockSuggestedParams);
            transactionServiceMock.get_public_key.mockResolvedValue(mockPublicKey);
            transactionServiceMock.signAndSubmitTransaction.mockResolvedValue(mockTxnId);

            // Mock the crafter chain
            const mockTransferBuilder = {
                addFirstValidRound: jest.fn().mockReturnThis(),
                addLastValidRound: jest.fn().mockReturnThis(),
                get: jest.fn().mockReturnValue({
                    encode: jest.fn().mockReturnValue(mockEncodedTxn),
                }),
            };

            crafterFactoryMock.transferAsset = jest.fn().mockReturnValue(mockTransferBuilder);
        });

        it('(OK) should transfer asset successfully', async () => {
            const result = await controller.assetTransfer(mockAssetTransferDto);

            expect(result).toEqual({
                txnId: mockTxnId,
                error: null,
            });

            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.get_public_key).toHaveBeenCalledWith({
                from: mockAssetTransferDto.from,
            });
            expect(crafterFactoryMock.transferAsset).toHaveBeenCalledWith(
                mockPublicKey,
                mockAssetTransferDto.assetId,
                mockAssetTransferDto.to,
                mockAssetTransferDto.amount
            );
            expect(transactionServiceMock.signAndSubmitTransaction).toHaveBeenCalledWith(
                mockEncodedTxn,
                mockAssetTransferDto.from
            );
        });

        it('(OK) should handle numeric string amount conversion', async () => {
            const dtoWithStringAmount = {
                ...mockAssetTransferDto,
                amount: '5000' as any,
            };

            const result = await controller.assetTransfer(dtoWithStringAmount);

            expect(result).toEqual({
                txnId: mockTxnId,
                error: null,
            });

            expect(crafterFactoryMock.transferAsset).toHaveBeenCalledWith(
                mockPublicKey,
                mockAssetTransferDto.assetId,
                mockAssetTransferDto.to,
                5000 // Should be converted to number
            );
        });

        it('(OK) should handle zero amount transfer', async () => {
            const zeroAmountDto = {
                ...mockAssetTransferDto,
                amount: 0,
            };

            const result = await controller.assetTransfer(zeroAmountDto);

            expect(result).toEqual({
                txnId: mockTxnId,
                error: null,
            });

            expect(crafterFactoryMock.transferAsset).toHaveBeenCalledWith(
                mockPublicKey,
                mockAssetTransferDto.assetId,
                mockAssetTransferDto.to,
                0
            );
        });

        it('(FAIL) should handle getSuggestedParams error', async () => {
            const errorMessage = 'Failed to get suggested params';
            transactionServiceMock.getSuggestedParams.mockRejectedValue(new Error(errorMessage));

            await expect(controller.assetTransfer(mockAssetTransferDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
        });

        it('(FAIL) should handle get_public_key error', async () => {
            const errorMessage = 'Failed to get public key';
            transactionServiceMock.get_public_key.mockRejectedValue(new Error(errorMessage));

            await expect(controller.assetTransfer(mockAssetTransferDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.getSuggestedParams).not.toHaveBeenCalled();
            expect(crafterFactoryMock.transferAsset).not.toHaveBeenCalled();
        });

        it('(FAIL) should handle asset transfer creation error', async () => {
            const errorMessage = 'Failed to create asset transfer transaction';
            crafterFactoryMock.transferAsset.mockImplementation(() => {
                throw new Error(errorMessage);
            });

            await expect(controller.assetTransfer(mockAssetTransferDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(crafterFactoryMock.transferAsset).toHaveBeenCalledTimes(1);
        });

        it('(FAIL) should handle signAndSubmitTransaction error', async () => {
            const errorMessage = 'Failed to sign and submit transaction';
            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(new Error(errorMessage));

            await expect(controller.assetTransfer(mockAssetTransferDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.signAndSubmitTransaction).toHaveBeenCalledWith(
                mockEncodedTxn,
                mockAssetTransferDto.from
            );
        });

        it('(FAIL) should handle error with response structure', async () => {
            const errorWithResponse = {
                response: {
                    data: {
                        message: 'API Asset Transfer Error',
                    },
                },
                message: 'Generic Asset Transfer Error',
            };

            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(errorWithResponse);

            await expect(controller.assetTransfer(mockAssetTransferDto)).rejects.toThrow('API Asset Transfer Error');
        });

        it('(FAIL) should handle unknown error type', async () => {
            const unknownError = 'String asset transfer error';
            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(unknownError);

            await expect(controller.assetTransfer(mockAssetTransferDto)).rejects.toThrow('Unknown error transferring asset');
        });
    });

    describe('optIn', () => {
        const mockSuggestedParams = {
            firstValid: 1000,
            lastValid: 2000,
            fee: 1000,
            minFee: 1000,
            genesisHash: new Uint8Array(Buffer.from('SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=', 'base64')),
            genesisID: 'testnet-v1.0',
        } as any;

        const mockOptInDto = {
            assetId: 12345,
            from: 'test-wallet-key',
        };

        const mockPublicKey = 'SENDER_ADDRESS_C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M';
        const mockEncodedTxn = new Uint8Array([1, 2, 3, 4, 5]);
        const mockTxnId = 'MOCK_OPT_IN_TXN_ID';

        beforeEach(() => {
            // Setup common mocks
            transactionServiceMock.getSuggestedParams.mockResolvedValue(mockSuggestedParams);
            transactionServiceMock.get_public_key.mockResolvedValue(mockPublicKey);
            transactionServiceMock.signAndSubmitTransaction.mockResolvedValue(mockTxnId);

            // Mock the crafter chain
            const mockTransferBuilder = {
                addFirstValidRound: jest.fn().mockReturnThis(),
                addLastValidRound: jest.fn().mockReturnThis(),
                get: jest.fn().mockReturnValue({
                    encode: jest.fn().mockReturnValue(mockEncodedTxn),
                }),
            };

            crafterFactoryMock.transferAsset = jest.fn().mockReturnValue(mockTransferBuilder);
        });

        it('(OK) should opt in to asset successfully', async () => {
            const result = await controller.optIn(mockOptInDto);

            expect(result).toEqual({
                txnId: mockTxnId,
                error: null,
            });

            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.get_public_key).toHaveBeenCalledWith({
                from: mockOptInDto.from,
            });
            // Opt-in is a transfer to self with 0 amount
            expect(crafterFactoryMock.transferAsset).toHaveBeenCalledWith(
                mockPublicKey,
                mockOptInDto.assetId,
                mockPublicKey, // to self
                0 // zero amount
            );
            expect(transactionServiceMock.signAndSubmitTransaction).toHaveBeenCalledWith(
                mockEncodedTxn,
                mockOptInDto.from
            );
        });

        it('(FAIL) should handle getSuggestedParams error', async () => {
            const errorMessage = 'Failed to get suggested params';
            transactionServiceMock.getSuggestedParams.mockRejectedValue(new Error(errorMessage));

            await expect(controller.optIn(mockOptInDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
        });

        it('(FAIL) should handle get_public_key error', async () => {
            const errorMessage = 'Failed to get public key';
            transactionServiceMock.get_public_key.mockRejectedValue(new Error(errorMessage));

            await expect(controller.optIn(mockOptInDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.getSuggestedParams).not.toHaveBeenCalled();
            expect(crafterFactoryMock.transferAsset).not.toHaveBeenCalled();
        });

        it('(FAIL) should handle signAndSubmitTransaction error', async () => {
            const errorMessage = 'Failed to sign and submit transaction';
            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(new Error(errorMessage));

            await expect(controller.optIn(mockOptInDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.signAndSubmitTransaction).toHaveBeenCalledWith(
                mockEncodedTxn,
                mockOptInDto.from
            );
        });

        it('(FAIL) should handle unknown error type', async () => {
            const unknownError = 'String opt-in error';
            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(unknownError);

            await expect(controller.optIn(mockOptInDto)).rejects.toThrow('Unknown error opting in to asset');
        });
    });

    describe('optOut', () => {
        const mockSuggestedParams = {
            firstValid: 1000,
            lastValid: 2000,
            fee: 1000,
            minFee: 1000,
            genesisHash: new Uint8Array(Buffer.from('SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=', 'base64')),
            genesisID: 'testnet-v1.0',
        } as any;

        const mockOptOutDto = {
            assetId: 12345,
            from: 'test-wallet-key',
            close: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
        };

        const mockPublicKey = 'SENDER_ADDRESS_C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M';
        const mockEncodedTxn = new Uint8Array([1, 2, 3, 4, 5]);
        const mockTxnId = 'MOCK_OPT_OUT_TXN_ID';

        beforeEach(() => {
            // Setup common mocks
            transactionServiceMock.getSuggestedParams.mockResolvedValue(mockSuggestedParams);
            transactionServiceMock.get_public_key.mockResolvedValue(mockPublicKey);
            transactionServiceMock.signAndSubmitTransaction.mockResolvedValue(mockTxnId);

            // Mock the crafter chain
            const mockTransferBuilder = {
                addAssetCloseTo: jest.fn().mockReturnThis(),
                addFirstValidRound: jest.fn().mockReturnThis(),
                addLastValidRound: jest.fn().mockReturnThis(),
                get: jest.fn().mockReturnValue({
                    encode: jest.fn().mockReturnValue(mockEncodedTxn),
                }),
            };

            crafterFactoryMock.transferAsset = jest.fn().mockReturnValue(mockTransferBuilder);
        });

        it('(OK) should opt out of asset successfully', async () => {
            const result = await controller.optOut(mockOptOutDto);

            expect(result).toEqual({
                txnId: mockTxnId,
                error: null,
            });

            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.get_public_key).toHaveBeenCalledWith({
                from: mockOptOutDto.from,
            });
            // Opt-out is a transfer to self with 0 amount and close-to address
            expect(crafterFactoryMock.transferAsset).toHaveBeenCalledWith(
                mockPublicKey,
                mockOptOutDto.assetId,
                mockPublicKey, // to self
                0 // zero amount
            );
            expect(transactionServiceMock.signAndSubmitTransaction).toHaveBeenCalledWith(
                mockEncodedTxn,
                mockOptOutDto.from
            );
        });

        it('(OK) should add close-to address for opt-out', async () => {
            const mockTransferBuilder = {
                addAssetCloseTo: jest.fn().mockReturnThis(),
                addFirstValidRound: jest.fn().mockReturnThis(),
                addLastValidRound: jest.fn().mockReturnThis(),
                get: jest.fn().mockReturnValue({
                    encode: jest.fn().mockReturnValue(mockEncodedTxn),
                }),
            };

            crafterFactoryMock.transferAsset = jest.fn().mockReturnValue(mockTransferBuilder);

            await controller.optOut(mockOptOutDto);

            expect(mockTransferBuilder.addAssetCloseTo).toHaveBeenCalledWith(mockOptOutDto.close);
        });

        it('(FAIL) should handle getSuggestedParams error', async () => {
            const errorMessage = 'Failed to get suggested params';
            transactionServiceMock.getSuggestedParams.mockRejectedValue(new Error(errorMessage));

            await expect(controller.optOut(mockOptOutDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
        });

        it('(FAIL) should handle get_public_key error', async () => {
            const errorMessage = 'Failed to get public key';
            transactionServiceMock.get_public_key.mockRejectedValue(new Error(errorMessage));

            await expect(controller.optOut(mockOptOutDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.getSuggestedParams).not.toHaveBeenCalled();
            expect(crafterFactoryMock.transferAsset).not.toHaveBeenCalled();
        });

        it('(FAIL) should handle signAndSubmitTransaction error', async () => {
            const errorMessage = 'Failed to sign and submit transaction';
            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(new Error(errorMessage));

            await expect(controller.optOut(mockOptOutDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.signAndSubmitTransaction).toHaveBeenCalledWith(
                mockEncodedTxn,
                mockOptOutDto.from
            );
        });

        it('(FAIL) should handle unknown error type', async () => {
            const unknownError = 'String opt-out error';
            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(unknownError);

            await expect(controller.optOut(mockOptOutDto)).rejects.toThrow('Unknown error opting out of asset');
        });
    });

    describe('Integration Tests', () => {
        const mockSuggestedParams = {
            firstValid: 1000,
            lastValid: 2000,
            fee: 1000,
            minFee: 1000,
            genesisHash: new Uint8Array(Buffer.from('SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=', 'base64')),
            genesisID: 'testnet-v1.0',
        } as any;

        const mockPublicKey = 'SENDER_ADDRESS_C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M';
        const mockEncodedTxn = new Uint8Array([1, 2, 3, 4, 5]);
        const mockTxnId = 'MOCK_TXN_ID';

        beforeEach(() => {
            transactionServiceMock.getSuggestedParams.mockResolvedValue(mockSuggestedParams);
            transactionServiceMock.get_public_key.mockResolvedValue(mockPublicKey);
            transactionServiceMock.signAndSubmitTransaction.mockResolvedValue(mockTxnId);

            const mockTransferBuilder = {
                addAssetCloseTo: jest.fn().mockReturnThis(),
                addFirstValidRound: jest.fn().mockReturnThis(),
                addLastValidRound: jest.fn().mockReturnThis(),
                get: jest.fn().mockReturnValue({
                    encode: jest.fn().mockReturnValue(mockEncodedTxn),
                }),
            };

            crafterFactoryMock.transferAsset = jest.fn().mockReturnValue(mockTransferBuilder);
        });

        it('should handle large asset amounts', async () => {
            const largeAmountDto = {
                assetId: 12345,
                from: 'test-wallet-key',
                to: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
                amount: 999999999999,
            };

            const result = await controller.assetTransfer(largeAmountDto);

            expect(result).toEqual({
                txnId: mockTxnId,
                error: null,
            });

            expect(crafterFactoryMock.transferAsset).toHaveBeenCalledWith(
                mockPublicKey,
                largeAmountDto.assetId,
                largeAmountDto.to,
                999999999999
            );
        });

        it('should validate method call sequences', async () => {
            const transferDto = {
                assetId: 12345,
                from: 'test-wallet-key',
                to: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
                amount: 1000,
            };

            await controller.assetTransfer(transferDto);

            // Verify all required methods were called
            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
            expect(crafterFactoryMock.transferAsset).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.signAndSubmitTransaction).toHaveBeenCalledTimes(1);
        });

        it('should handle different asset IDs correctly', async () => {
            const differentAssetDto = {
                assetId: 999999,
                from: 'test-wallet-key',
                to: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
                amount: 100,
            };

            await controller.assetTransfer(differentAssetDto);

            expect(crafterFactoryMock.transferAsset).toHaveBeenCalledWith(
                mockPublicKey,
                999999, // Different asset ID
                differentAssetDto.to,
                100
            );
        });
    });
});
