"""
Model persistence utilities for saving and loading trained ML models.
Allows collaborators to use pre-trained models without retraining.
"""

import os
import joblib
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Model storage directory
MODEL_DIR = Path(__file__).parent.parent / 'saved_models'
MODEL_DIR.mkdir(exist_ok=True)


class ModelPersistence:
    """Handles saving and loading of trained ML models."""
    
    @staticmethod
    def save_model(model_obj, model_name: str, metadata: dict = None):
        """
        Save a trained model to disk.
        
        Args:
            model_obj: The model object to save (can include multiple models)
            model_name: Name for the saved model file
            metadata: Optional metadata (accuracy, training date, etc.)
        """
        try:
            filepath = MODEL_DIR / f"{model_name}.joblib"
            
            # Package model with metadata
            package = {
                'model': model_obj,
                'metadata': metadata or {}
            }
            
            joblib.dump(package, filepath, compress=3)
            logger.info(f"✓ Model saved: {filepath}")
            logger.info(f"  Size: {os.path.getsize(filepath) / 1024 / 1024:.2f} MB")
            
            return str(filepath)
            
        except Exception as e:
            logger.error(f"Failed to save model {model_name}: {e}")
            raise
    
    @staticmethod
    def load_model(model_name: str):
        """
        Load a trained model from disk.
        
        Args:
            model_name: Name of the model file to load
            
        Returns:
            Tuple of (model_obj, metadata)
        """
        try:
            filepath = MODEL_DIR / f"{model_name}.joblib"
            
            if not filepath.exists():
                logger.warning(f"Model file not found: {filepath}")
                return None, None
            
            package = joblib.load(filepath)
            logger.info(f"✓ Model loaded: {filepath}")
            
            if isinstance(package, dict) and 'model' in package:
                return package['model'], package.get('metadata', {})
            else:
                # Legacy format (just the model)
                return package, {}
                
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            return None, None
    
    @staticmethod
    def model_exists(model_name: str) -> bool:
        """Check if a saved model exists."""
        filepath = MODEL_DIR / f"{model_name}.joblib"
        return filepath.exists()
    
    @staticmethod
    def list_saved_models():
        """List all saved models."""
        models = []
        for filepath in MODEL_DIR.glob("*.joblib"):
            size_mb = os.path.getsize(filepath) / 1024 / 1024
            models.append({
                'name': filepath.stem,
                'path': str(filepath),
                'size_mb': round(size_mb, 2)
            })
        return models
    
    @staticmethod
    def delete_model(model_name: str):
        """Delete a saved model."""
        filepath = MODEL_DIR / f"{model_name}.joblib"
        if filepath.exists():
            os.remove(filepath)
            logger.info(f"✓ Model deleted: {filepath}")
            return True
        return False
