

// data is an object of column names and values
const updateHelper = (table_name, update_id, data) => {
    let column_names = Object.keys(data)
        .filter(x => {
            return data[x] !== undefined;
        });

    let fields = column_names
        .map((x, i) => {
            return x + ' = $' + (i + 1);
        }).join(', ');

    let values = column_names.map(x => {
        return data[x];
    });
    values.push(update_id);
    return {
        query: 'update ' + table_name + ' set ' + fields + ' where id = $' + (column_names.length + 1),
        values: values
    };
}

const getDistance = (latitude1, longitude1, latitude2, longitude2) => {   
    let y = latitude2 - latitude1;    
    let x = longitude2 - longitude1;        
    return Math.sqrt(x * x + y * y);   
   }

module.exports = {
    updateHelper,
    getDistance
}