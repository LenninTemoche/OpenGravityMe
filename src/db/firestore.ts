import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { config } from '../config/index.js';

// Initialize Firebase Admin SDK
const serviceAccountPath = config.GOOGLE_APPLICATION_CREDENTIALS;

let db: FirebaseFirestore.Firestore;

try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
  console.log('✅ Firestore connected successfully');
} catch (error) {
  console.error('❌ Error initializing Firestore:', error);
  process.exit(1);
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

interface MessageDoc {
  userId: string;
  role: string;
  content: string;
  timestamp: FirebaseFirestore.Timestamp;
}

interface MemoryDoc {
  value: string;
}

export const dbService = {
  saveMessage: async (userId: string, role: string, content: string): Promise<void> => {
    try {
      await db.collection('messages').add({
        userId,
        role,
        content,
        timestamp: admin.firestore.Timestamp.now(),
      } satisfies MessageDoc);
    } catch (error) {
      console.error('Error saving message to Firestore:', error);
    }
  },

  getHistory: async (userId: string, limit: number = 20): Promise<Message[]> => {
    try {
      const snapshot = await db
        .collection('messages')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const messages: Message[] = snapshot.docs
        .map((doc) => {
          const data = doc.data() as MessageDoc;
          return {
            role: data.role as Message['role'],
            content: data.content,
          };
        })
        .reverse(); // Reverse to get chronological order

      return messages;
    } catch (error) {
      console.error('Error fetching history from Firestore:', error);
      return [];
    }
  },

  setMemory: async (key: string, value: string): Promise<void> => {
    try {
      await db.collection('memory').doc(key).set({ value } satisfies MemoryDoc);
    } catch (error) {
      console.error('Error setting memory in Firestore:', error);
    }
  },

  getMemory: async (key: string): Promise<string | null> => {
    try {
      const doc = await db.collection('memory').doc(key).get();
      if (doc.exists) {
        return (doc.data() as MemoryDoc).value;
      }
      return null;
    } catch (error) {
      console.error('Error getting memory from Firestore:', error);
      return null;
    }
  },
};
