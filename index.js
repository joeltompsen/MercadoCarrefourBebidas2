const puppeteer = require('puppeteer');
const fs = require('fs');

const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};

(async () => {
    const urlBase = 'https://mercado.carrefour.com.br/bebidas';
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    await page.goto(urlBase, {
        waitUntil: 'networkidle2'
    });

    await page.waitForSelector('button[title="Insira seu CEP"]');

    await page.evaluate(() => {
        const buttons = document.getElementsByTagName('button');
        for (let button of buttons) {
            if (button.getAttribute('title') === 'Insira seu CEP') {
                button.click();
                break;
            }
        }
    });

    await page.waitForSelector('span'); 

    const findTextInSpan = async (text) => {
        return await page.evaluate((text) => {
            const spans = Array.from(document.querySelectorAll('span'));
            const span = spans.find(span => span.innerText.includes(text));
            return span ? span.innerText : null;
        }, text);
    };

    const textToFind = 'Retire na Loja';
    const foundText = await findTextInSpan(textToFind);
    if (foundText) {
        console.log(`Texto encontrado: ${foundText}`);
        await page.evaluate((text) => {
            const spans = Array.from(document.querySelectorAll('span'));
            const span = spans.find(span => span.innerText.includes(text));
            if (span) {
                span.click();
            }
        }, textToFind);
    } else {
        console.log('Texto não encontrado.');
    }


    await page.waitForSelector('select#selectCity');

    // Seleciona a cidade "Piracicaba"
    await page.select('select#selectCity', 'Piracicaba');

    const selectedCity = await page.evaluate(() => {
        const selectElement = document.querySelector('select#selectCity');
        return selectElement.value; 
    });

    console.log(`Cidade selecionada: ${selectedCity}`); 

    await page.waitForSelector('article');
    
    await page.evaluate(() => {
        const articles = document.getElementsByTagName('article');
        for (let article of articles) {
            if (article.innerHTML.includes('Hipermercado Piracicaba')) {
                console.log('Encontrado o artigo que contém "Hipermercado Piracicaba". Clicando...');
                article.click();
                break;
            }
        }
    });

    const getProducts = async () => {
        await page.waitForSelector('[data-fs-product-listing-results="true"]');
        return await page.evaluate(() => {

            const getProductPrices = (product) => {
                const products_prices = product.getElementsByTagName('span');
                let prices = [];
                for (let product_price of products_prices) {
                    if (product_price.getAttribute('data-test-id') === 'price') {
                        const productPrice = product_price.getAttribute('data-value');
                        prices.push(productPrice);
                    }
                }
                return prices;
            };


            const getProductName = (product) => {
                const products = product.getElementsByTagName('a');
                for (let productElement of products) {
                    if (productElement.getAttribute('data-testid') === 'product-link') {
                        return productElement.innerText.trim();
                    }
                }
                return null;
            };

            const productSection = document.querySelector('[data-fs-product-listing-results="true"]');
            const products = [];
            if (productSection) {
                const productList = productSection.getElementsByTagName('li');
                Array.from(productList).forEach((product) => {
                    const name = getProductName(product);
                    const prices = getProductPrices(product);
                    if (name && prices.length > 0) {
                        products.push({
                            name: name,
                            prices: prices,  
                        });
                    }
                });
            }
            return products;
        });
    };

    let allProducts = [];
    let currentPage = 1;
    while (currentPage <= 50) {
        await sleep(10000); 
        await page.goto(`${urlBase}?page=${currentPage}`, { waitUntil: 'networkidle2' });


        
        let pageProducts = await getProducts();
        while(pageProducts.length <= 0){
            pageProducts = await getProducts();
        }

        console.log(`Página ${currentPage}: ${pageProducts.length} produtos encontrados.`);

        allProducts = allProducts.concat(pageProducts);

        currentPage++;
    }
    fs.writeFileSync('output.json', JSON.stringify(allProducts, null, 2));
    console.log('Produtos salvos em output.json');
    await browser.close();
})();
