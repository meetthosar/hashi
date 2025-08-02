import { Test, TestingModule } from '@nestjs/testing';
import { Payment } from './transaction.pay.controller';
import { TransactionService } from './transaction.service';
import { ConfigService } from '@nestjs/config';
import { AlgorandTransactionCrafter } from '@algorandfoundation/algo-models';
import createMockInstance from 'jest-create-mock-instance';

describe('Payment Controller', () => {
    let controller: Payment;
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
            controllers: [Payment],
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

        controller = module.get<Payment>(Payment);
        
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

            const newController = new Payment(
                transactionServiceMock,
                configServiceMock,
                crafterFactoryMock
            );

            expect(configServiceMock.get).toHaveBeenCalledWith('GENESIS_ID');
            expect(configServiceMock.get).toHaveBeenCalledWith('GENESIS_HASH');
        });
    });

    describe('makePayment', () => {
        const mockSuggestedParams = {
            firstValid: 1000,
            lastValid: 2000,
            fee: 1000,
            minFee: 1000,
            genesisHash: new Uint8Array(Buffer.from('SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=', 'base64')),
            genesisID: 'testnet-v1.0',
        } as any;

        const mockPaymentDto = {
            from: 'test-wallet-key',
            to: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
            amt: 1000000,
        };

        const mockPublicKey = 'SENDER_ADDRESS_C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M';
        const mockEncodedTxn = new Uint8Array([1, 2, 3, 4, 5]);
        const mockTxnId = 'MOCK_PAYMENT_TXN_ID';

        beforeEach(() => {
            // Setup common mocks
            transactionServiceMock.getSuggestedParams.mockResolvedValue(mockSuggestedParams);
            transactionServiceMock.get_public_key.mockResolvedValue(mockPublicKey);
            transactionServiceMock.signAndSubmitTransaction.mockResolvedValue(mockTxnId);

            // Mock the crafter chain
            const mockPaymentBuilder = {
                addFirstValidRound: jest.fn().mockReturnThis(),
                addLastValidRound: jest.fn().mockReturnThis(),
                get: jest.fn().mockReturnValue({
                    encode: jest.fn().mockReturnValue(mockEncodedTxn),
                }),
            };

            crafterFactoryMock.pay = jest.fn().mockReturnValue(mockPaymentBuilder);
        });

        it('(OK) should make payment successfully', async () => {
            const result = await controller.makePayment(mockPaymentDto);

            expect(result).toEqual({
                txnId: mockTxnId,
                error: null,
            });

            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.get_public_key).toHaveBeenCalledWith({
                from: mockPaymentDto.from,
            });
            expect(crafterFactoryMock.pay).toHaveBeenCalledWith(
                mockPaymentDto.amt,
                mockPublicKey,
                mockPaymentDto.to
            );
            expect(transactionServiceMock.signAndSubmitTransaction).toHaveBeenCalledWith(
                mockEncodedTxn,
                mockPaymentDto.from
            );
        });

        it('(OK) should handle numeric string amount conversion', async () => {
            const dtoWithStringAmount = {
                ...mockPaymentDto,
                amt: '5000000' as any,
            };

            const result = await controller.makePayment(dtoWithStringAmount);

            expect(result).toEqual({
                txnId: mockTxnId,
                error: null,
            });

            expect(crafterFactoryMock.pay).toHaveBeenCalledWith(
                5000000, // Should be converted to number
                mockPublicKey,
                mockPaymentDto.to
            );
        });

        it('(OK) should handle zero amount payment', async () => {
            const zeroAmountDto = {
                ...mockPaymentDto,
                amt: 0,
            };

            const result = await controller.makePayment(zeroAmountDto);

            expect(result).toEqual({
                txnId: mockTxnId,
                error: null,
            });

            expect(crafterFactoryMock.pay).toHaveBeenCalledWith(
                0,
                mockPublicKey,
                mockPaymentDto.to
            );
        });

        it('(FAIL) should handle getSuggestedParams error', async () => {
            const errorMessage = 'Failed to get suggested params';
            transactionServiceMock.getSuggestedParams.mockRejectedValue(new Error(errorMessage));

            await expect(controller.makePayment(mockPaymentDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
        });

        it('(FAIL) should handle get_public_key error', async () => {
            const errorMessage = 'Failed to get public key';
            transactionServiceMock.get_public_key.mockRejectedValue(new Error(errorMessage));

            await expect(controller.makePayment(mockPaymentDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.getSuggestedParams).not.toHaveBeenCalled();
            expect(crafterFactoryMock.pay).not.toHaveBeenCalled();
        });

        it('(FAIL) should handle payment transaction creation error', async () => {
            const errorMessage = 'Failed to create payment transaction';
            crafterFactoryMock.pay.mockImplementation(() => {
                throw new Error(errorMessage);
            });

            await expect(controller.makePayment(mockPaymentDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(crafterFactoryMock.pay).toHaveBeenCalledTimes(1);
        });

        it('(FAIL) should handle transaction encoding error', async () => {
            const errorMessage = 'Failed to encode transaction';
            const mockPaymentBuilder = {
                addFirstValidRound: jest.fn().mockReturnThis(),
                addLastValidRound: jest.fn().mockReturnThis(),
                get: jest.fn().mockReturnValue({
                    encode: jest.fn().mockImplementation(() => {
                        throw new Error(errorMessage);
                    }),
                }),
            };

            crafterFactoryMock.pay.mockReturnValue(mockPaymentBuilder as any);

            await expect(controller.makePayment(mockPaymentDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(crafterFactoryMock.pay).toHaveBeenCalledTimes(1);
        });

        it('(FAIL) should handle signAndSubmitTransaction error', async () => {
            const errorMessage = 'Failed to sign and submit transaction';
            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(new Error(errorMessage));

            await expect(controller.makePayment(mockPaymentDto)).rejects.toThrow(errorMessage);

            expect(transactionServiceMock.signAndSubmitTransaction).toHaveBeenCalledWith(
                mockEncodedTxn,
                mockPaymentDto.from
            );
        });

        it('(FAIL) should handle error with response structure', async () => {
            const errorWithResponse = {
                response: {
                    data: {
                        message: 'API Payment Error',
                    },
                },
                message: 'Generic Payment Error',
            };

            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(errorWithResponse);

            await expect(controller.makePayment(mockPaymentDto)).rejects.toThrow('API Payment Error');
        });

        it('(FAIL) should handle error without response structure', async () => {
            const simpleError = new Error('Simple payment error');
            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(simpleError);

            await expect(controller.makePayment(mockPaymentDto)).rejects.toThrow('Simple payment error');
        });

        it('(FAIL) should handle unknown error type', async () => {
            const unknownError = 'String payment error';
            transactionServiceMock.signAndSubmitTransaction.mockRejectedValue(unknownError);

            await expect(controller.makePayment(mockPaymentDto)).rejects.toThrow('Unknown error making payment');
        });

        it('should properly handle large payment amounts', async () => {
            const largeAmountDto = {
                ...mockPaymentDto,
                amt: 999999999999, // Large amount
            };

            const result = await controller.makePayment(largeAmountDto);

            expect(result).toEqual({
                txnId: mockTxnId,
                error: null,
            });

            expect(crafterFactoryMock.pay).toHaveBeenCalledWith(
                999999999999,
                mockPublicKey,
                mockPaymentDto.to
            );
        });

        it('should validate payment flow with correct method calls', async () => {
            await controller.makePayment(mockPaymentDto);

            // Verify all required methods were called
            expect(transactionServiceMock.get_public_key).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.getSuggestedParams).toHaveBeenCalledTimes(1);
            expect(crafterFactoryMock.pay).toHaveBeenCalledTimes(1);
            expect(transactionServiceMock.signAndSubmitTransaction).toHaveBeenCalledTimes(1);
        });

        it('should handle different recipient address formats', async () => {
            const differentRecipientDto = {
                ...mockPaymentDto,
                to: 'DIFFERENT_RECIPIENT_ADDRESS_123456789ABCDEF',
            };

            const result = await controller.makePayment(differentRecipientDto);

            expect(result).toEqual({
                txnId: mockTxnId,
                error: null,
            });

            expect(crafterFactoryMock.pay).toHaveBeenCalledWith(
                mockPaymentDto.amt,
                mockPublicKey,
                'DIFFERENT_RECIPIENT_ADDRESS_123456789ABCDEF'
            );
        });
    });
});
