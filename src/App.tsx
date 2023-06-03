import { useState } from 'react';

import { NFT, Acc, TempAcc } from './pi.ts'
import { upload } from './nft_storage.ts'

import './App.css'

/*
  可供测试用的私钥,复制粘贴进入对话框并点确认可进入：
  SCASCZUHKE3BVVXVMKPEPMHD4AARYLYTGGKMGTYSF2NULLZDCPUMMYU7
  SBYX6GSRB3VMY5FLZPKLW4RGM2I4WKR5RO6LYASY747D63HFUB6APOY6
*/

function App() {
  const [account, setAccount] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [balance, setBalance] = useState('请求中');

  async function accGen() {
    if (privateKey == null) {
      throw new Error('私钥不可为空')
    }
    const acc = new Acc(privateKey);
    setAccount(acc);
  }

  async function createNFT(event: Event) {
    if (account == null) {
      throw new Error('账户不可为null');
    }

    // 创造nft的流程:

    // 建立一个临时钱包作为nft创造者
    const tempAcc = new TempAcc();

    try {
      // 用用户钱包激活临时钱包
      await tempAcc.active({ sourceAcc: account, isTestNet: true });

      // 建立一个测试用的nft对象，实际使用时替换对应的字符。
      const nft = new NFT()
        .setName("TestNFT")
        .setDescrption("This is a test NFT for learning purpose")
        .setCode("shadowNFT2")
        .setIssuer(tempAcc) // issuer对应临时钱包
        .setDistributor(account); // distrubitor对应用户钱包

      // 上传文件到nft.storage，nft对象提供文件对应的元数据信息，上传成功后nft对象会获得ipfs的元数据CID.
      await upload(nft, event.target.files[0]);

      // 在pi链上激活nft
      await nft.active({ sourceAcc: tempAcc, isTestNet: true });
    } catch (e) {
      console.log(e);
      return e;
    }
  }

  if (account == null) {
    return (
      <>
        <form>
          <label>
            <input type='text' placeholder='请输入pi钱包私钥' onChange={(event) => setPrivateKey(event.target.value)} />
          </label>
        </form>
        <br />
        <button onClick={accGen}>确认</button>
      </>
    )
  }

  account.balance().then(balance => setBalance(balance));

  return (
    <>
      <ul className='wallet-info'>
        <li>钱包地址: {account.publicKey()}</li>
        <li>钱包余额: {balance}</li>
      </ul>
      <br />
      <input id='upload' type='file' style={{ display: 'none' }} onChange={createNFT} />
      <>*. 每次创建NFT都会消费至少50币,请留意余额避免创建失败</>
      <button onClick={() => document.getElementById('upload')?.click()}>创建NFT</button>
    </>
  );
}

export default App
