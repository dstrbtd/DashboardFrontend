import React, { useEffect, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import websocketConfig from '../config/websocketUrls'; 

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function MinerGraphV1() {
  const [chartData, setChartData] = useState(null);
  const [runId, setRunId] = useState(null);
  const wsRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(websocketConfig.WS_URL);

    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setRunId(data.run_id);

        const minerDatasets = Object.entries(data.miners).map(([uid, miner], idx) => ({
          label: `Miner ${uid}`,
          data: miner.loss,
          borderColor: `hsl(${(idx * 36) % 360}, 70%, 60%)`,
          backgroundColor: 'transparent',
          yAxisID: 'y1',
          tension: 0.3,
          pointRadius: 0,
        }));

        const validatorUIDs = Object.keys(data.validators);
        let epochs = [];
        let peerCounts = [];

        if (validatorUIDs.length > 0) {
          const validator = data.validators[validatorUIDs[0]];
          epochs = validator.peers.epoch;
          peerCounts = validator.peers.count;
        }

        const peerDataset = {
          label: 'Number of Peers',
          data: peerCounts,
          borderColor: '#000000',
          borderWidth: 2,
          pointStyle: 'cross',
          pointRadius: 5,
          yAxisID: 'y2',
        };

        setChartData({
          labels: epochs,
          datasets: [...minerDatasets, peerDataset],
        });

        setTimeout(() => {
          if (chartRef.current) {
            chartRef.current.resize();
          }
        }, 300);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.resize(); 
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const options = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#e0e0e0',
          font: {
            family: "'IBM Plex Mono', monospace",
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: runId
          ? `Run ${runId} - Loss vs Number of Peers`
          : 'Miner Loss (10 Random Miners) vs Number of Peers per Epoch',
        color: '#e0e0e0',
        font: {
          family: "'IBM Plex Mono', monospace",
          size: 18,
          weight: 'bold',
        },
      },
      tooltip: {
        backgroundColor: '#333',
        padding: 12,
        titleFont: {
          family: "'IBM Plex Mono', monospace",
          size: 14,
        },
        bodyFont: {
          family: "'IBM Plex Mono', monospace",
          size: 12,
        },
        callbacks: {
          title: function(context) {
            return `Epoch: ${context[0].label}`;
          },
          beforeBody: function(context) {
            // Find the peer count dataset
            const peerDataset = context.find(item => item.dataset.label === 'Number of Peers');
            return peerDataset ? `Peers: ${peerDataset.raw}` : '';
          },
          label: function(context) {
            // Skip the peer count dataset since we show it in beforeBody
            if (context.dataset.label === 'Number of Peers') return null;
            
            return `${context.dataset.label}: ${context.parsed.y.toFixed(4)}`;
          },
          labelColor: function(context) {
            return {
              borderColor: context.dataset.borderColor,
              backgroundColor: context.dataset.borderColor,
              borderWidth: 2,
              borderRadius: 2,
            };
          }
        }
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Epoch',
          color: '#e0e0e0',
        },
        ticks: {
          color: '#e0e0e0',
        },
        grid: {
          color: 'rgba(224, 224, 224, 0.1)',
        },
      },
      y1: {
        position: 'left',
        title: {
          display: true,
          text: 'Loss',
          color: '#e0e0e0',
        },
        ticks: {
          color: '#e0e0e0',
          beginAtZero: true,
          max: 1,
        },
        grid: {
          color: 'rgba(224, 224, 224, 0.1)',
        },
      },
      y2: {
        position: 'right',
        title: {
          display: true,
          text: 'Number of Peers',
          color: '#e0e0e0',
        },
        ticks: {
          color: '#e0e0e0',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  return (
    <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      {chartData ? (
        <Line
          ref={(el) => {
            if (el) chartRef.current = el.chartInstance ?? el;
          }}
          data={chartData}
          options={options}
        />
      ) : (
        <p>Loading chart...</p>
      )}
    </div>
  );
}