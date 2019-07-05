import React, {PureComponent} from 'react';
import {Bar} from 'react-chartjs-2';
import Chart from "chart.js";
//import * as zoom from 'chartjs-plugin-zoom'

export default class ChartBar extends PureComponent{
    chartEl = null;
    constructor(props){
        super(props);
        this.state = {
            chartOpt: {
                legend: {
                    display: false
                },
                scales: {
                    xAxes: [{
                        stacked: true,
                        offset: true,
                        ticks: {
                            beginAtZero: true
                        }
                    }],
                    yAxes: [{
                        stacked: true,
                        ticks: {
                            beginAtZero: true
                        }
                    }]
                },
                maintainAspectRatio: false,
                /*pan: {
                    enabled: false,
                    mode: 'x',
                    onPan: function({chart}) { console.log(`I was panned!!!`); }
                },
                zoom: {
                    enabled: true,
                    drag: false,
                    mode: 'x',
                    onZoom: function({chart}) { console.log(`I was zoomed!!!`); }
                }*/
            }
        };

        this.chartRef = React.createRef();

        this.updateChartData = this.updateChartData.bind(this);
    }

    updateChartData(){
        const myChartRef = this.chartRef.current.getContext("2d");

        this.chartEl = new Chart(myChartRef, {
            type: "bar",
            data: {
                labels: this.props.labels,
                datasets: [{
                    label: this.props.label,
                    data: this.props.data,
                    backgroundColor: `rgba(${this.props.color.join(',')}, 0.6)`,
                    borderColor: `rgba(${this.props.color.join(',')}, 1)`,
                    borderWidth: 2,
                    hoverBorderWidth: 0
                }],
            },
            options: this.state.chartOpt
        });
    }

    /*componentDidMount() {
        this.updateChartData();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        this.updateChartData();
    }*/

    render(){
        let {chartOpt} = this.state;
        let datasets = [];
        this.props.content.forEach(item=>{
            datasets.push({
                label: item.label,
                data: item.data,
                backgroundColor: `rgba(${item.color.join(',')}, 0.6)`,
                borderColor: `rgba(${item.color.join(',')}, 1)`,
                borderWidth: 2,
                hoverBorderWidth: 0
            });
        });
        const chartData = {
            labels: this.props.labels,
            datasets: datasets,
        };
        if(this.props.showLegend){
            chartOpt.legend.display=true;
        }
        chartOpt.scales.xAxes[0]['scaleLabel'] = {
            display: true,
            labelString: this.props.xLabel,
            fontColor: "black",
        };
        chartOpt.scales.yAxes[0]['scaleLabel'] = {
            display: true,
            labelString: this.props.yLabel,
            fontColor: "black",
        };
        return (
            <React.Fragment>
                <Bar
                    data={chartData}
                    options={chartOpt}
                />
            {/*<canvas
                id={this.props.id}
                ref={this.chartRef}
            />*/}
            </React.Fragment>
        );
    }
}