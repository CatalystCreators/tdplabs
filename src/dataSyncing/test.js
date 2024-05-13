const { MongoClient } = require("mongodb");

// Connection URL for the source and destination databases
const sourceUrl =
  "mongodb+srv://admin:9DVXxuKDExkCZNba@cluster0.mwznv.mongodb.net/HausNHaus?retryWrites=true&w=majority";
const destUrl =
  "mongodb+srv://cloudservers:2MokIqHdVYXZgae6@cluster0.uj9nq.mongodb.net/";

// Connect to the source and destination databases
async function copyData() {
  const sourceClient = new MongoClient(sourceUrl, { useUnifiedTopology: true });
  const destClient = new MongoClient(destUrl, { useUnifiedTopology: true });

  try {
    await sourceClient.connect();
    await destClient.connect();

    const sourceDB = sourceClient.db();
    const destDB = destClient.db();

    // List the collections in the source database
    const collections = await sourceDB.listCollections().toArray();

    for (const collection of collections) {
      const collectionName = collection.name;
      const sourceCollection = sourceDB.collection(collectionName);
      const destCollection = destDB.collection(collectionName);

      // Copy data from source collection to destination collection
      const cursor = sourceCollection.find();

      await cursor.forEach(async (document) => {
        await destCollection.insertOne(document);
      });

      console.log(
        `Copied data from ${collectionName} to the destination database.`
      );
    }

    console.log("Data copy completed.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    sourceClient.close();
    destClient.close();
  }
}

copyData();
