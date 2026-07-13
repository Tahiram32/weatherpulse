import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

let db;
if (getApps().length === 0) {
  const firebaseConfigPath = "./firebase-applet-config.json";
  if (fs.existsSync(firebaseConfigPath)) {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    const app = initializeApp({ projectId: config.projectId });
    db = getFirestore(app, config.firestoreDatabaseId);
  }
}

async function test() {
  try {
    const q = db.collectionGroup('articles')
      .where('status', '==', 'pending')
      .where('publishAt', '<=', new Date().toISOString());
    await q.get();
    console.log("Success!");
  } catch (err) {
    console.error(err.message);
  }
}
test();
