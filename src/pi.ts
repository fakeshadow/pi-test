import StellarSdk, { Account, Keypair, TransactionBuilder, Operation, Transaction, Asset, AccountResponse } from 'stellar-sdk';

// 如果pi链转账出现tx_bad_auth错误请读：
// 如果怀疑networkpassphrase有误请咨询pi官方
const MAINNET = 'Pi Network';
const TESTNET = "Pi Testnet";

const server = new StellarSdk.Server(import.meta.env.VITE_PI_HOST);

// 获取基准交易手续费，可用来测试节点是否可连接
export async function getBaseFee(): Promise<number> {
    return await server.fetchBaseFee();
}

interface ActiveOpt {
    sourceAcc: Acc;
    isTestNet: boolean;
}

// 用户账户
export class Acc {
    private _key: Keypair;

    constructor(secret: string) {
        this._key = Keypair.fromSecret(secret);
    }

    // 获得账号的公钥
    publicKey(): string {
        return this._key.publicKey()
    }

    // 仅供测试使用
    secret(): string {
        return this._key.secret()
    }

    // 向pi节点请求账号的具体信息
    async account(): Promise<Account> {
        return server.loadAccount(this.publicKey())
    }

    // 向pi节点请求账号的余额信息
    async balance(): Promise<string> {
        const acc: AccountResponse = await server.loadAccount(this.publicKey());
        const balance = acc.balances.map((balance) => Number(balance.balance)).reduce((total, current) => total + current);
        return balance.toString()
    }

    // 为转账签名，避免公开暴露_key域
    async sign(tx: Transaction): Promise<void> {
        await tx.sign(this._key);
    }
}

// 随机账号，由用户账号激活
export class TempAcc extends Acc {
    constructor() {
        const key = Keypair.random();
        super(key.secret())
    }

    // 临时账户需要激活否则无法在链上使用
    async active({ sourceAcc, isTestNet }: ActiveOpt): Promise<void> {
        const pass = isTestNet ? TESTNET : MAINNET;
        const fee = await getBaseFee();
        const account = await sourceAcc.account();
        const tx = new TransactionBuilder(account, { fee: fee.toString(), networkPassphrase: pass })
            .addOperation(Operation.createAccount({
                destination: this.publicKey(),
                startingBalance: "50",
            }))
            .setTimeout(120)
            .build();
        sourceAcc.sign(tx);
        await server.submitTransaction(tx);
    }
}

// nft元数据，用来构造转账
export class NFT {
    private _name: string;
    private _desp: string;
    private _code: string;
    private _metaCID: string;
    private issueAcc: Acc | null;
    private distributeAcc: Acc | null;

    constructor() {
        this._name = '';
        this._desp = '';
        this._code = '';
        this._metaCID = '';
        this.issueAcc = null;
        this.distributeAcc = null;
    }

    setName(n: string): this {
        this._name = n;
        return this
    }

    setDescrption(d: string): this {
        this._desp = d;
        return this
    }

    setCode(c: string): this {
        this._code = c;
        return this
    }

    // 设定NFT发起者
    setIssuer(acc: Acc): this {
        this.issueAcc = acc;
        return this
    }

    // 设定NFT发行者
    setDistributor(acc: Acc): this {
        this.distributeAcc = acc;
        return this
    }

    // 测试用，其他环境请勿手动设置
    setMetaCID(m: string): this {
        this._metaCID = m;
        return this
    }

    // 利用回调上传NFT，回调必须返回需要的imageCID和metaCID
    async uploadNFT(fn: (info: NFTUploadInfo) => Promise<NFTUploadResult>) {
        if (this.issueAcc == null) {
            throw new Error('NFT名称不可为空');
        }

        const res = await fn({
            name: this._name,
            desp: this._desp,
            code: this._code,
            issuer: this.issueAcc.publicKey(),
        });

        this._metaCID = res.metaCID;
    }

    // 创建nft
    async active({ sourceAcc, isTestNet }: ActiveOpt) {
        if (this._name == '') {
            throw new Error('NFT名称不可为空');
        }

        if (this.issueAcc == null) {
            throw new Error('NFT发起者不可为空');
        }

        if (this.distributeAcc == null) {
            throw new Error('NFT发行者不可为空');
        }

        if (this._metaCID == '') {
            throw new Error('NFT未完成上传');
        }

        if (this.issueAcc.publicKey() != sourceAcc.publicKey()) {
            throw new Error('NFT的发行者和激活者不匹配');
        }

        const asset = new Asset(this._code, this.issueAcc.publicKey());

        const pass = isTestNet ? TESTNET : MAINNET;

        const fee = await getBaseFee();

        const issueAccount = await this.issueAcc.account();
        const distributeAccount = await this.distributeAcc.account();

        // 在发行者和发起者之间建立资产信任线
        const tx1 = new TransactionBuilder(distributeAccount, { fee: fee.toString(), networkPassphrase: pass })
            .addOperation(Operation.changeTrust({
                asset,
                limit: '1',
            }))
            .setTimeout(120)
            .build();
        this.distributeAcc.sign(tx1);
        const res1 = await server.submitTransaction(tx1);
        console.log(res1);

        // 发起者将nft资产转让给发行者
        const tx2 = new TransactionBuilder(issueAccount, { fee: (fee * 3).toString(), networkPassphrase: pass })
            .addOperation(Operation.payment({
                destination: this.distributeAcc.publicKey(),
                asset,
                amount: '1',
                source: this.issueAcc.publicKey()
            }))
            .addOperation(Operation.setOptions({
                masterWeight: 0,
                source: this.issueAcc.publicKey()
            }))
            .addOperation(Operation.manageData({
                name: this._code,
                value: this._metaCID
            }))
            .setTimeout(120)
            .build();
        await this.issueAcc.sign(tx2);
        const res2 = await server.submitTransaction(tx2);
        console.log(res2);
    }
}

export interface NFTUploadInfo {
    name: string;
    desp: string;
    code: string;
    issuer: string;
}

export interface NFTUploadResult {
    imgCID: string,
    metaCID: string,
}
