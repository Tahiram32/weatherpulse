import { db } from './src/firebase.ts';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore';

async function test() {
  try {
    const q = query(
      collectionGroup(db, 'articles'),
      where('status', '==', 'pending'),
      where('publishAt', '<=', new Date().toISOString())
    );
    await getDocs(q);
    console.log("Success!");
  } catch (err) {
    console.error(err.message);
  }
}
test();
