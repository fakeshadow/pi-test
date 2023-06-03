import {NFTStorage} from 'nft.storage';
import { NFT, NFTUploadInfo } from './pi.ts';

// 此模组使用nft storage，如果使用其他存储服务只需在nft.uploadNFT的回调中修改代码即可。
// 需注意回调需要返回{ imgCID, metaCID } 以便NFT对象可以正确获取元数据。

export async function upload(nft: NFT, file: File): Promise<void> {
  await nft.uploadNFT(async (info: NFTUploadInfo) => {
    const client = new NFTStorage({ token: import.meta.env.VITE_NFT_STORAGE_TOKEN });
    const imgCID = await client.storeBlob(file);
    const metadata = {
      name: info.name,
      description: info.desp,
      url: `https://nftstorage.link/ipfs/${imgCID}`,
      issuer: info.issuer,
      code: info.code
    };
    const metaCID = await client.storeBlob(new Blob([JSON.stringify(metadata)]));

    console.log(`访问链接查看nft图: https://nftstorage.link/ipfs/${imgCID}`);
    console.log(`访问链接查看nft元数据: https://nftstorage.link/ipfs/${metaCID}`);

    return { imgCID, metaCID }
  })
}
