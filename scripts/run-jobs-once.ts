import { runFetchRadar } from '@/jobs/fetchRadar';
import { runFetchStations } from '@/jobs/fetchStations';
import { runBuildFeaturesAndAlerts } from '@/jobs/buildFeaturesAndAlerts';

async function main() {
  await runFetchRadar();
  await runFetchStations();
  await runBuildFeaturesAndAlerts();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


