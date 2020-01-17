const { connect, findBlockSeq, findLastIrreversibleBlockAcceptBefore } = require('nats-queue-sync');

async function main() {
    const json = process.argv[2];

    const { connectString, blockId, blockNum } = JSON.parse(json);

    if (!connectString || !blockId || !blockNum) {
        console.error('Invalid arguments');
        process.exit(1);
    }

    const stan = await connect(connectString);

    try {
        await run(stan, {
            id: blockId,
            block_num: blockNum,
        });
    } catch (err) {
        console.error('Run error:', err);
        process.exit(1);
    }

    stan.close();
}

async function run(stan, irrBlock) {
    const found = await findBlockSeq(stan, irrBlock);

    // console.log('Irr block found:', cutBlock(found));

    const foundAccept = await findLastIrreversibleBlockAcceptBefore(stan, found);

    // console.log('Accept Irr block found:', cutBlock(foundAccept));

    console.log(JSON.stringify({ sequence: foundAccept.sequence }));
}

main().catch(err => {
    console.error('Global error:', err);
});
