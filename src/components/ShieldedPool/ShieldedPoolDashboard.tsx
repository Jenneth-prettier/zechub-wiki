// src/components/ShieldedPool/ShieldedPoolDashboard.tsx
"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import Button from "@/components/Button/Button";
import Checkbox from "@/components/Checkbox/Checkbox";
import NodeCountChart from "@/components/NodeCountChart";
import Tools from "@/components/Tools";
import useExportDashboardAsPNG from "@/hooks/useExportDashboardAsPNG";
import { Spinner } from "flowbite-react";
import PrivacySetVisualization from "../PrivacySet/PrivacySetVisualization";
import NamadaSupplyChart, { SeriesPoint } from "./NamadaSupplyChart";
import { ToolOptions, toolOptionLabels } from "../Tools/tools";
import NoData from "../../assets/nodata.svg";
import {
  namadatoolOptionLabels,
  NamadaToolOptions,
  NamadaTools,
} from "../Tools/Namadatools";
import CryptoMetrics from "./Metric";

const ShieldedPoolChart = dynamic(() => import("./ShieldedPoolChart"), {
  ssr: true,
});
const TransactionSummaryChart = dynamic(
  () => import("../TransactionSummaryChart"),
  { ssr: true }
);
const ZecIssuanceSummaryChart = dynamic(
  () => import("../ZecIssuanceSummaryChart"),
  { ssr: true }
);
const NetInflowsOutFlowsChart = dynamic(
  () => import("../Charts/NetInflowsOutflowsChart"),
  { ssr: true }
);

const DataUrlOptions = {
  defaultUrl: "/data/zcash/shielded_supply.json",
  sproutUrl: "/data/zcash/sprout_supply.json",
  saplingUrl: "/data/zcash/sapling_supply.json",
  orchardUrl: "/data/zcash/orchard_supply.json",
  txsummaryUrl: "/data/zcash/transaction_summary.json",
  netInflowsOutflowsUrl: "/data/zcash/netinflowoutflow.json",
  nodecountUrl: "/data/zcash/nodecount.json",
  difficultyUrl: "/data/zcash/difficulty.json",
  lockboxUrl: "/data/zcash/lockbox.json",
  shieldedTxCountUrl: "/data/zcash/shieldedtxcount.json",
  issuanceUrl: "/data/zcash/issuance.json",
  apiUrl:
    "https://api.github.com/repos/ZecHub/zechub-wiki/commits?path=public/data/shielded_supply.json",
  namadaSupplyUrl: "/data/namada/namada_supply.json",
} as const;

const blockchainInfoUrl = "/api/blockchain-info";

interface BlockchainInfo {
  blocks: number;
  transactions_24h: number;
  market_cap_usd: number;
  market_price_usd: number;
  market_price_btc: number;
}

type SupplyData = { close: string; supply: number };
type ShieldedTxCount = { sapling: number; orchard: number; timestamp: string };
type NodeCountData = { Date: string; nodecount: string };
type NamadaAsset = { id: string; totalSupply: string };

async function getBlockchainData(): Promise<BlockchainInfo | null> {
  try {
    const res = await fetch(
      "https://api.blockchair.com/zcash/stats?key=A___nnFHttBygZPrKgm5WZyXU3WCondo"
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as BlockchainInfo;
  } catch {
    return null;
  }
}

async function getBlockchainInfo(): Promise<number | null> {
  try {
    const res = await fetch(blockchainInfoUrl);
    if (!res.ok) return null;
    const json = await res.json();
    return parseInt(json.chainSupply.chainValueZat, 10) * 1e-8;
  } catch {
    return null;
  }
}

async function getSupplyData(url: string): Promise<SupplyData[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return (await res.json()) as SupplyData[];
  } catch {
    return [];
  }
}

async function getLastUpdatedDate(): Promise<string> {
  try {
    const res = await fetch(DataUrlOptions.apiUrl);
    if (!res.ok) return "N/A";
    const d = await res.json();
    return d[0]?.commit?.committer?.date ?? "N/A";
  } catch {
    return "N/A";
  }
}

async function getShieldedTxCount(): Promise<ShieldedTxCount[] | null> {
  try {
    const res = await fetch(DataUrlOptions.shieldedTxCountUrl);
    if (!res.ok) return null;
    return (await res.json()) as ShieldedTxCount[];
  } catch {
    return null;
  }
}

async function getNodeCountData(url: string): Promise<NodeCountData[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return (await res.json()) as NodeCountData[];
  } catch {
    return [];
  }
}

function formatDate(s: string | null): string {
  if (!s) return "N/A";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString();
}

function transformSupplyData(
  d: SupplyData | null
): { timestamp: string; supply: number } | null {
  return d ? { timestamp: d.close, supply: d.supply } : null;
}

type PoolKey = "default" | "sprout" | "sapling" | "orchard";

export default function ShieldedPoolDashboard() {
  const [selectedPool, setSelectedPool] = useState<PoolKey>("default");
  const [selectedNamadaPool, setSelectedNamadaPool] =
    useState<string>("default");
  const [selectedCoin, setSelectedCoin] = useState<
    "Zcash" | "Penumbra" | "Namada"
  >("Zcash");
  const [selectedTool, setSelectedTool] = useState<ToolOptions>(
    ToolOptions.supply
  );

  const [selectedNamadaTool, setSelectedNamadaTool] =
    useState<NamadaToolOptions>(NamadaToolOptions.supply);
  const [selectedToolName, setSelectedToolName] = useState<string>(
    toolOptionLabels[ToolOptions.supply]
  );
  const [cumulativeCheck, setCumulativeCheck] = useState(true);
  const [filterSpamCheck, setFilterSpamCheck] = useState(false);

  const [blockchainInfo, setBlockchainInfo] = useState<BlockchainInfo | null>(
    null
  );
  const [circulation, setCirculation] = useState<number | null>(null);
  const [supplies, setSupplies] = useState<Record<PoolKey, SupplyData | null>>({
    default: null,
    sprout: null,
    sapling: null,
    orchard: null,
  });
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [shieldedTxCount, setShieldedTxCount] = useState<
    ShieldedTxCount[] | null
  >(null);
  const [latestNodeCount, setLatestNodeCount] = useState<number | null>(null);

  const [namadaRaw, setNamadaRaw] = useState<any[]>([]);
  const [namadaAssets, setNamadaAssets] = useState<NamadaAsset[]>([]);
  const [selectedNamadaAsset, setSelectedNamadaAsset] = useState<string>("");
  const [namadaSeries, setNamadaSeries] = useState<any>();

  const { divChartRef, handleSaveToPng } = useExportDashboardAsPNG();

  // 1) Corrected getDataUrl: first switch on tool, then pool
  const getDataUrl = (): string => {
    // supply tool → choose by pool
    if (selectedTool === ToolOptions.supply) {
      switch (selectedPool) {
        case "sprout":
          return DataUrlOptions.sproutUrl;
        case "sapling":
          return DataUrlOptions.saplingUrl;
        case "orchard":
          return DataUrlOptions.orchardUrl;
        default:
          return DataUrlOptions.defaultUrl;
      }
    }

    // other tools → direct URLs
    switch (selectedTool) {
      case ToolOptions.transaction:
        return DataUrlOptions.txsummaryUrl;
      case ToolOptions.net_inflows_outflows:
        return DataUrlOptions.netInflowsOutflowsUrl;
      case ToolOptions.nodecount:
        return DataUrlOptions.nodecountUrl;
      case ToolOptions.difficulty:
        return DataUrlOptions.difficultyUrl;
      case ToolOptions.lockbox:
        return DataUrlOptions.lockboxUrl;
      case "issuance":
        return DataUrlOptions.issuanceUrl;
      case ToolOptions.privacy_set:
        return ""; // privacy_set is a visualization, not a data URL
      default:
        return DataUrlOptions.defaultUrl;
    }
  };

  const getDataColor = (): string => {
    switch (selectedPool) {
      case "sprout":
        return "#A020F0";
      case "sapling":
        return "#FFA500";
      case "orchard":
        return "#32CD32";
      default:
        return "url(#area-background-gradient)";
    }
  };

  useEffect(() => {
    getBlockchainData().then((d) => d && setBlockchainInfo(d));
    getBlockchainInfo().then((c) => setCirculation(c));
    getLastUpdatedDate().then((d) => setLastUpdated(d));

    getSupplyData(DataUrlOptions.defaultUrl).then((a) =>
      setSupplies((s) => ({ ...s, default: a.pop() || null }))
    );
    getSupplyData(DataUrlOptions.sproutUrl).then((a) =>
      setSupplies((s) => ({ ...s, sprout: a.pop() || null }))
    );
    getSupplyData(DataUrlOptions.saplingUrl).then((a) =>
      setSupplies((s) => ({ ...s, sapling: a.pop() || null }))
    );
    getSupplyData(DataUrlOptions.orchardUrl).then((a) =>
      setSupplies((s) => ({ ...s, orchard: a.pop() || null }))
    );

    getShieldedTxCount().then((d) => d && setShieldedTxCount(d));
    getNodeCountData(DataUrlOptions.nodecountUrl).then((a) => {
      if (a.length) setLatestNodeCount(Number(a[a.length - 1].nodecount));
    });

    // Namada raw + assets
    fetch(DataUrlOptions.namadaSupplyUrl)
      .then((r) => r.json())
      .then((data: any[]) => {
        if (!data) return;
        setNamadaRaw(data);
        const list: NamadaAsset[] = data[0]?.Total_Supply || [];
        setNamadaAssets(list);
        if (list.length) setSelectedNamadaAsset(list[0].id);
      })
      .catch(console.error);
  }, []);

  // 2) Patched “last updated” effect
  useEffect(() => {
    (async () => {
      const key = (
        selectedPool === "default" ? "defaultUrl" : `${selectedPool}Url`
      ) as keyof typeof DataUrlOptions;
      const arr = await getSupplyData(DataUrlOptions[key]);
      setLastUpdated(arr.pop()?.close || "N/A");
    })();
  }, [selectedPool]);

  // Build Namada series
  useEffect(() => {
    if (!selectedNamadaAsset) return;
    const inputData = namadaRaw || [];
    // 1. Filter entries where the selected token exists (and has non-empty supply)
    const filteredData = inputData.filter((entry) =>
      entry.Total_Supply.some(
        (item: { id: string; totalSupply: string }) =>
          item.id === selectedNamadaAsset && item.totalSupply !== ""
      )
    );

    // 2. Extract x (dates) and y (data) for the selected token
    const x = filteredData.map((entry) => entry.Date);
    const y = {
      name: selectedNamadaAsset,
      data: filteredData.map((entry) => {
        const tokenEntry = entry.Total_Supply.find(
          (item: { id: string }) => item.id === selectedNamadaAsset
        );
        return selectedNamadaAsset != "Namada"
          ? parseFloat(tokenEntry.totalSupply) / 1000000
          : parseFloat(tokenEntry.totalSupply);
      }),
    };
    const result = { x, y };
    setNamadaSeries(result);
  }, [namadaRaw, selectedNamadaAsset]);

  if (!blockchainInfo) {
    return (
      <div className="flex justify-center mt-48">
        <Spinner />
      </div>
    );
  }

  const poolLabels = {
    default: "Total Shielded",
    sprout: "Sprout Pool",
    sapling: "Sapling Pool",
    orchard: "Orchard Pool",
  } as const;
  const poolKeys = Object.keys(poolLabels) as PoolKey[];

  const handleToolChange = (tool: ToolOptions) => {
    setSelectedTool(tool);
    if (
      tool === ToolOptions.supply ||
      tool === ToolOptions.transaction ||
      tool === ToolOptions.privacy_set
    ) {
      setSelectedPool("default");
    }
    setSelectedToolName(toolOptionLabels[tool]);
  };

  // NAMADA supply chart
  const handlenNamadaToolChange = (tool: NamadaToolOptions) => {
    setSelectedNamadaPool(tool);
    if (tool === NamadaToolOptions.supply) {
      setSelectedNamadaPool("default");
    }
    setSelectedToolName(namadatoolOptionLabels[tool]);
  };


  return (
    <div className="mt-28">
      {/* Header & Coin Buttons */}
      <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
        <h2 className="font-bold text-xl">{selectedToolName}</h2>
        <div className="flex gap-4">
          <Button
            text="Zcash"
            onClick={() => setSelectedCoin("Zcash")}
            className="bg-orange-400/75 text-white rounded-full px-4 py-2"
          />
          <Button
            text="Penumbra"
            onClick={() => setSelectedCoin("Penumbra")}
            className="bg-purple-500/75 text-white rounded-full px-4 py-2"
          />
          <Button
            text="Namada"
            onClick={() => setSelectedCoin("Namada")}
            className="bg-yellow-300/75 text-white rounded-full px-4 py-2"
          />
        </div>
      </div>

      {/* Chart & Tools */}
      <div className="border p-4 rounded-lg relative">
        {selectedCoin === "Zcash" && (
          <Tools
            onToolChange={handleToolChange}
            defaultSelected={ToolOptions.supply}
          />
        )}
        {selectedCoin === "Namada" && (
          <NamadaTools
            onNamadaToolChange={handlenNamadaToolChange}
            defaultSelected={NamadaToolOptions.supply}
          />
        )}

        <div ref={divChartRef}>
          {selectedCoin === "Zcash" && (
            <>
              {selectedTool === ToolOptions.supply && (
                <ShieldedPoolChart
                  dataUrl={getDataUrl()}
                  color={getDataColor()}
                />
              )}
              {selectedTool === ToolOptions.transaction && (
                <>
                  <div className="flex gap-4 justify-center mb-4">
                    <Checkbox
                      checked={cumulativeCheck}
                      onChange={setCumulativeCheck}
                      label="Cumulative"
                    />
                    <Checkbox
                      checked={filterSpamCheck}
                      onChange={setFilterSpamCheck}
                      label="Filter Spam"
                    />
                  </div>
                  <TransactionSummaryChart
                    dataUrl={DataUrlOptions.txsummaryUrl}
                    pool={selectedPool}
                    cumulative={cumulativeCheck}
                    filter={filterSpamCheck}
                    applyFilter={!cumulativeCheck || filterSpamCheck}
                  />
                </>
              )}
              {(selectedTool === ToolOptions.nodecount ||
                selectedTool === ToolOptions.difficulty ||
                selectedTool === ToolOptions.lockbox) && (
                <NodeCountChart dataUrl={getDataUrl()} color={getDataColor()} />
              )}
              {selectedTool === ToolOptions.net_inflows_outflows && (
                <NetInflowsOutFlowsChart
                  dataUrl={getDataUrl()}
                  color={getDataColor()}
                />
              )}
              {selectedTool === "issuance" && (
                <ZecIssuanceSummaryChart
                  dataUrl={DataUrlOptions.issuanceUrl}
                  pool={selectedPool}
                  cumulative={cumulativeCheck}
                  filter={filterSpamCheck}
                />
              )}
              {selectedTool === ToolOptions.privacy_set && (
                <PrivacySetVisualization />
              )}
            </>
          )}

          {selectedCoin === "Namada" &&
            selectedNamadaTool === NamadaToolOptions.supply && (
              <NamadaSupplyChart data={namadaSeries} width={800} height={400} />
            )}

          {selectedCoin !== "Zcash" && selectedCoin !== "Namada" && (
            <div className="w-full h-[400px] flex flex-col items-center justify-center">
              <Image src={NoData} width={200} height={250} alt="No data" />
              <p>Chart data for {selectedCoin} unavailable</p>
            </div>
          )}
        </div>

        {/* Pool toggles (Zcash) */}
        {selectedTool === ToolOptions.supply && selectedCoin === "Zcash" && (
          <div className="mt-8 flex flex-wrap justify-center gap-6">
            {poolKeys.map((key) => (
              <div key={key} className="flex flex-col items-center">
                <Button
                  text={poolLabels[key]}
                  className={`py-2 px-4 rounded-full ${
                    selectedPool === key
                      ? "bg-[#1984c7] text-white"
                      : "bg-gray-400 text-white"
                  }`}
                  onClick={() => setSelectedPool(key)}
                />
                <span className="text-sm text-gray-600 mt-1">
                  {(supplies[key]?.supply || 0).toLocaleString()} ZEC
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Namada toggles */}
        {selectedTool === ToolOptions.supply && selectedCoin === "Namada" && (
          <div className="mt-8 flex flex-wrap justify-center gap-6">
            {namadaAssets.map((asset) => (
              <div key={asset.id} className="flex flex-col items-center">
                <Button
                  text={asset.id}
                  className={`py-2 px-4 rounded-full ${
                    selectedNamadaAsset === asset.id
                      ? "bg-yellow-500 text-white"
                      : "bg-gray-400 text-white"
                  }`}
                  onClick={() => setSelectedNamadaAsset(asset.id)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Export & Last Updated */}
        <div className="flex justify-end items-center gap-4 mt-4">
          <span className="text-sm text-gray-500">
            Last updated: {formatDate(lastUpdated)}
          </span>
          <Button
            text="Export PNG"
            className="bg-blue-500 text-white rounded-full px-4 py-2"
            onClick={() =>
              handleSaveToPng(
                selectedPool,
                {
                  sproutSupply: transformSupplyData(supplies.sprout),
                  saplingSupply: transformSupplyData(supplies.sapling),
                  orchardSupply: transformSupplyData(supplies.orchard),
                },
                selectedTool
              )
            }
          />
        </div>
        {selectedCoin === 'Zcash' &&
        <div className="flex flex-wrap gap-8 justify-center items-center mt-8">
          <div className="border p-4 rounded-md text-center">
            <h3 className="font-bold text-lg">Market Cap</h3>
            <p>${blockchainInfo.market_cap_usd.toLocaleString()}</p>
          </div>
          <div className="border p-4 rounded-md text-center">
            <h3 className="font-bold text-lg">ZEC in Circulation</h3>
            <p>{circulation?.toLocaleString() ?? "N/A"} ZEC</p>
          </div>
          <div className="border p-4 rounded-md text-center">
            <h3 className="font-bold text-lg">Market Price (USD)</h3>
            <p>${blockchainInfo.market_price_usd.toFixed(2)}</p>
          </div>
          <div className="border p-4 rounded-md text-center">
            <h3 className="font-bold text-lg">Market Price (BTC)</h3>
            <p>{blockchainInfo.market_price_btc}</p>
          </div>
          <div className="border p-4 rounded-md text-center">
            <h3 className="font-bold text-lg">Blocks</h3>
            <p>{blockchainInfo.blocks.toLocaleString()}</p>
          </div>
          <div className="border p-4 rounded-md text-center">
            <h3 className="font-bold text-lg">24h Transactions</h3>
            <p>{blockchainInfo.transactions_24h.toLocaleString()}</p>
          </div>
          <div className="border p-4 rounded-md text-center">
            <h3 className="font-bold text-lg">Shielded TX (24h)</h3>
            <p>
              {shieldedTxCount?.length
                ? `Sapling: ${shieldedTxCount[
                    shieldedTxCount.length - 1
                  ].sapling.toLocaleString()} | Orchard: ${shieldedTxCount[
                    shieldedTxCount.length - 1
                  ].orchard.toLocaleString()}`
                : "N/A"}
            </p>
          </div>
        </div>
        }
        {(selectedCoin == "Penumbra") && <CryptoMetrics selectedCoin={selectedCoin} />}

        {(selectedCoin == "Namada") && <CryptoMetrics selectedCoin={selectedNamadaAsset} />}
      </div>
    </div>
  );
}
