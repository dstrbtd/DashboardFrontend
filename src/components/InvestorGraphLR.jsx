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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function InvestorGraphLR() {
  const chartRef = useRef(null);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    // Load JSON from public folder
    fetch('/learning_rate.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((learningRateData) => {
        // Extract the "Run 6" object from the JSON
        const runData = learningRateData['Run 6'];

        // Extract and sort steps ascending numerically
        const steps = Object.keys(runData)
          .map((key) => Number(key.replace('Outer Step ', '')))
          .sort((a, b) => a - b);

        const labels = steps;
        const data = steps.map((step) => runData[`Outer Step ${step}`]);

        setChartData({
          labels,
          datasets: [
            {
              label: 'Learning Rate',
              data,
              borderColor: 'rgba(246, 246, 247, 1)',
              backgroundColor: 'transparent',
              tension: 0.4,
              pointRadius: 0, // hide points normally
            },
          ],
        });
      })
      .catch((err) => {
        console.error('Error loading learning_rate.json:', err);
      });
  }, []);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: { display: false },
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: '#111',
        titleColor: '#eee',
        bodyColor: '#eee',
        cornerRadius: 0,
        caretSize: 5,
        displayColors: false,
        callbacks: {
          label: function (context) {
            const value = context.parsed.y;
            return `Learning Rate: ${value.toFixed(5)}`;
          },
        },
      },
    },
    layout: {
      padding: 10,
    },
    interaction: {
      mode: 'nearest',
      intersect: false,
    },
    scales: {
      x: {
        title: { display: true, text: 'Outer Step', color: '#eee' },
        ticks: { color: '#eee' },
        grid: {
          color: 'transparent',
          borderColor: 'transparent',
        },
      },
      y: {
        title: { display: false, text: 'Learning Rate', color: '#eee' },
        ticks: { color: '#eee' },
        grid: {
          color: 'transparent',
          borderColor: 'transparent',
        },
      },
    },
    elements: {
      line: {
        borderColor: '#eee',
        borderWidth: 1.5,
        tension: 0.3,
      },
      point: {
        radius: 0,
        hoverRadius: 5,
        backgroundColor: '#eee',
        hoverBackgroundColor: '#eee',
      },
    },
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h3
        className="text-ibm"
        style={{
          color: '#eee',
          marginBottom: 8,
          textAlign: 'left',
          flexShrink: 0,
        }}
      >
        Learning Rate
      </h3>
      <div style={{ flexGrow: 1 }}>
        {chartData ? (
          <Line ref={chartRef} data={chartData} options={options} />
        ) : (
          <p>Loading...</p>
        )}
      </div>
    </div>
  );
}
