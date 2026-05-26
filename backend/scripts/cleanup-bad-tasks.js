/**
 * scripts/cleanup-bad-tasks.js
 *
 * One-shot migration script — finds and removes task documents whose
 * `assignedTo` or `createdBy` fields contain plain strings instead of
 * valid MongoDB ObjectIds. These were inserted before the User model was
 * in place and cause Mongoose ValidationErrors on document initialisation.
 *
 * Run once:
 *   node scripts/cleanup-bad-tasks.js
 *   node scripts/cleanup-bad-tasks.js --dry-run   # inspect without deleting
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('❌  MONGO_URI not set in .env');
    process.exit(1);
  }

  console.log(`\n🔌  Connecting to MongoDB…`);
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log(`✅  Connected to: ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  const db = mongoose.connection.db;
  const collection = db.collection('tasks');

  // Helper: check if a value is NOT a valid 24-char hex ObjectId
  const isInvalidId = (val) => {
    if (val == null) return false;                       // null is fine (optional field)
    if (val instanceof mongoose.Types.ObjectId) return false;
    if (typeof val === 'object' && val._bsontype === 'ObjectID') return false;
    // Stored as a string — check it's a proper hex ObjectId
    return !/^[a-f\d]{24}$/i.test(String(val));
  };

  // Fetch all tasks as raw docs (bypasses Mongoose casting completely)
  const allTasks = await collection.find({}).toArray();
  console.log(`📦  Total tasks in collection: ${allTasks.length}`);

  const badTasks = allTasks.filter(
    (t) => isInvalidId(t.assignedTo) || isInvalidId(t.createdBy)
  );

  if (badTasks.length === 0) {
    console.log('✨  No corrupted tasks found — nothing to clean up.\n');
    await mongoose.disconnect();
    return;
  }

  console.log(`⚠️   Found ${badTasks.length} corrupted task(s):\n`);
  badTasks.forEach((t) => {
    console.log(`  • _id: ${t._id}`);
    console.log(`    title     : ${t.title}`);
    console.log(`    createdBy : ${JSON.stringify(t.createdBy)}  ${isInvalidId(t.createdBy) ? '← INVALID' : ''}`);
    console.log(`    assignedTo: ${JSON.stringify(t.assignedTo)}  ${isInvalidId(t.assignedTo) ? '← INVALID' : ''}`);
    console.log('');
  });

  if (DRY_RUN) {
    console.log('🔍  DRY RUN — no documents were deleted.\n');
    await mongoose.disconnect();
    return;
  }

  const ids = badTasks.map((t) => t._id);
  const result = await collection.deleteMany({ _id: { $in: ids } });
  console.log(`🗑️   Deleted ${result.deletedCount} corrupted task(s).\n`);

  await mongoose.disconnect();
  console.log('🔌  Disconnected. Done.\n');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
