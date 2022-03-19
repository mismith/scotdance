import { read } from 'xlsx';

onmessage = ({ data: { method, args = [] } }) => {
  switch (method) {
    case 'readFile': {
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          const data = event.target.result;
          const workbook = read(data, { type: 'binary' });
          const { SheetNames, Sheets } = workbook; // only send back what we need
          postMessage({ workbook: { SheetNames, Sheets } });
        };
        reader.readAsBinaryString(...args);
      } catch (error) {
        postMessage({ error });
      }
    }
  }
};
