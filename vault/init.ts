import * as fs from "fs";
import axios from 'axios'
import * as dotenv from "dotenv";
dotenv.config();

const VAULT_BASE_URL = process.env.VAULT_BASE_URL;
console.log('VAULT base url: ', VAULT_BASE_URL);

// init vault POST request
axios.post(`${VAULT_BASE_URL}/v1/sys/init`, {
  secret_shares: 1,
  secret_threshold: 1
},
{
  headers: {
    "Content-Type": "application/json",
  },
}).then(async (result) => {
  console.log('Vault Seal JSON data: ', result.data);
  fs.writeFileSync("vault-seal-keys.json", JSON.stringify(result.data));
    
  var keys = result.data.keys;
  // set token for all following requests
  const token: string = result.data.root_token;
  console.log(`token : ${token}`)

  // unseal vault server
  const unsealResult = await axios.post(`${VAULT_BASE_URL}/v1/sys/unseal`, {
    secret_shares: 1,
    key: keys[0]
  }, {
    headers: {
      'X-Vault-Token': token,
      "Content-Type": "application/json",
    }
  });

  // check if unsealed
  if(unsealResult.data.sealed) throw new Error('vault is not unsealed')

  // notify success
  console.log(`vault is unsealed`)
}).catch(err => {
  console.log(`failed to init. Trying to unseal if already initialized...`, err)

  // trying to unseal
  const firstKey: string = JSON.parse(fs.readFileSync('vault-seal-keys.json').toString()).keys[0]

  axios.post(`${VAULT_BASE_URL}/v1/sys/unseal`, {
    secret_shares: 1,
    key: firstKey
  },
  {
    headers: {
      "Content-Type": "application/json",
    },
  }).then(async (result) => {
    // check if unsealed
    if(result.data.sealed) throw new Error('vault is not unsealed')

    // notify success
    console.log(`vault is unsealed`)
  }).catch(err => {
    console.error(err)
  })
})