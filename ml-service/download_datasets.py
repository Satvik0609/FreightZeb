"""
Download and prepare real logistics datasets from Kaggle.

Datasets to use:
1. DataCo SMART SUPPLY CHAIN - https://www.kaggle.com/datasets/shashwatwork/dataco-smart-supply-chain-for-big-data-analysis
2. Food Delivery Time Prediction - https://www.kaggle.com/datasets/gauravmalik26/food-delivery-dataset

Instructions:
1. Install kaggle: pip install kaggle
2. Setup Kaggle API credentials: https://www.kaggle.com/docs/api
3. Run this script: python download_datasets.py
"""

import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def download_datasets():
    """Download datasets from Kaggle."""
    
    # Create data directory
    os.makedirs('data', exist_ok=True)
    
    try:
        import kaggle
        logger.info("Kaggle API found, downloading datasets...")
        
        # Download DataCo Supply Chain dataset
        logger.info("Downloading DataCo SMART SUPPLY CHAIN dataset...")
        kaggle.api.dataset_download_files(
            'shashwatwork/dataco-smart-supply-chain-for-big-data-analysis',
            path='data/',
            unzip=True
        )
        logger.info("✓ DataCo dataset downloaded")
        
        # Download Food Delivery dataset
        logger.info("Downloading Food Delivery Time dataset...")
        kaggle.api.dataset_download_files(
            'gauravmalik26/food-delivery-dataset',
            path='data/',
            unzip=True
        )
        logger.info("✓ Food Delivery dataset downloaded")
        
        logger.info("\n✅ All datasets downloaded successfully!")
        logger.info("Datasets location: ml-service/data/")
        
    except ImportError:
        logger.error("❌ Kaggle API not installed")
        logger.info("\nTo install: pip install kaggle")
        logger.info("Setup API key: https://www.kaggle.com/docs/api")
        
    except Exception as e:
        logger.error(f"❌ Error downloading datasets: {e}")
        logger.info("\nAlternative: Download manually from:")
        logger.info("1. https://www.kaggle.com/datasets/shashwatwork/dataco-smart-supply-chain-for-big-data-analysis")
        logger.info("2. https://www.kaggle.com/datasets/gauravmalik26/food-delivery-dataset")
        logger.info("\nPlace CSV files in: ml-service/data/")


if __name__ == "__main__":
    download_datasets()
