

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

// This function is sourced from https://stackoverflow.com/a/18883819
//This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
const calcCrow = (lat1, lon1, lat2, lon2) => {
    var R = 6371; // km
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var lat1 = toRad(lat1);
    var lat2 = toRad(lat2);

    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
}

// Converts numeric degrees to radians
function toRad(Value) {
    return Value * Math.PI / 180;
}

module.exports = {
    updateHelper,
    calcCrow
}