import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

if (getApps().length === 0) {
  const firebaseConfigPath = "./firebase-applet-config.json";
  if (fs.existsSync(firebaseConfigPath)) {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    const app = initializeApp({ projectId: config.projectId });
  }
}

const db = getFirestore();
async function test() {
  try {
    const q = db.collection('clients');
    const res = await q.get();
    console.log("Success!", res.size);
  } catch (err) {
    console.error(err.message);
  }
}
test();
