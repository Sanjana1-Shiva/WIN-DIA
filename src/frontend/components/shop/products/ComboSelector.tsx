"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiCheck, FiAlertCircle } from "react-icons/fi";
import toast from "react-hot-toast";
import styles from "./ComboSelector.module.scss";

type Flavor = {
  id: string;
  name: string;
  available: boolean;
  stock: number;
};

type ComboSelectorProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selections: Record<string, number>) => void;
  availableFlavors: Flavor[];
};

/**
 * Combo Selector Modal
 * 
 * Correct Rules:
 * - When 4 flavors available: ALL 4 are MANDATORY (1 each) + user picks 2 more from any flavor
 * - When 3 flavors available (1 out of stock): ALL 3 are MANDATORY (1 each) + user picks 3 more
 * - Total must always be 6 packets
 */
export function ComboSelector({ isOpen, onClose, onConfirm, availableFlavors }: ComboSelectorProps) {
  const [selections, setSelections] = useState<Record<string, number>>({});
  
  // Filter available flavors first
  const availableOnly = availableFlavors.filter(f => f.available);
  const unavailableCount = availableFlavors.filter(f => !f.available).length;
  const mandatoryCount = availableOnly.length; // All available flavors are mandatory
  const userChoiceCount = 6 - mandatoryCount; // Remaining packets are user's choice
  
  // Initialize with 1 of each mandatory flavor
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, number> = {};
      availableOnly.forEach(f => {
        initial[f.id] = 1; // Start with 1 of each mandatory flavor
      });
      setSelections(initial);
    }
  }, [isOpen, availableOnly]);

  const totalSelected = Object.values(selections).reduce((sum, count) => sum + count, 0);
  const flavorsWithSelection = Object.entries(selections).filter(([_, count]) => count > 0).length;
  
  // Validation: Must have all mandatory flavors (1 each minimum) + user picks remaining
  const allMandatorySelected = availableOnly.every(f => (selections[f.id] || 0) >= 1);
  const isValid = totalSelected === 6 && allMandatorySelected;
  const remaining = 6 - totalSelected;

  const handleIncrement = (flavorId: string) => {
    if (totalSelected >= 6) {
      toast.error("Maximum 6 packets allowed");
      return;
    }
    
    const flavor = availableFlavors.find(f => f.id === flavorId);
    if (!flavor) return;
    
    const currentCount = selections[flavorId] || 0;
    if (currentCount >= flavor.stock) {
      toast.error(`Only ${flavor.stock} packets available for ${flavor.name}`);
      return;
    }
    
    setSelections(prev => ({
      ...prev,
      [flavorId]: currentCount + 1,
    }));
  };

  const handleDecrement = (flavorId: string) => {
    const currentCount = selections[flavorId] || 0;
    // Can't go below 1 (mandatory minimum)
    if (currentCount > 1) {
      setSelections(prev => ({
        ...prev,
        [flavorId]: currentCount - 1,
      }));
    } else {
      toast.error("Each flavor must have at least 1 packet (mandatory)");
    }
  };

  const handleConfirm = () => {
    if (!isValid) {
      if (totalSelected !== 6) {
        toast.error(`Please select exactly 6 packets (${remaining} ${remaining === 1 ? 'packet' : 'packets'} ${remaining > 0 ? 'more needed' : 'too many'})`);
      } else if (!allMandatorySelected) {
        toast.error(`All ${mandatoryCount} flavors are mandatory (at least 1 packet each)`);
      }
      return;
    }

    onConfirm(selections);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className={styles.overlay} onClick={onClose}>
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={styles.header}>
            <div>
              <h2>Customize Your Combo</h2>
              <p>All {mandatoryCount} flavors included (1 each mandatory) + pick {userChoiceCount} more from your favorites!</p>
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <FiX />
            </button>
          </div>

          {/* Progress */}
          <div className={styles.progress}>
            <div className={styles.progressBar}>
              <motion.div
                className={styles.progressFill}
                initial={{ width: 0 }}
                animate={{ width: `${(totalSelected / 6) * 100}%` }}
                style={{
                  backgroundColor: totalSelected === 6 ? '#28a745' : '#c9a84c',
                }}
              />
            </div>
            <div className={styles.progressText}>
              <span>
                {totalSelected} / 6 packets selected
                {flavorsWithSelection > 0 && ` · ${flavorsWithSelection} flavor${flavorsWithSelection > 1 ? 's' : ''}`}
              </span>
              {remaining > 0 && (
                <span className={styles.remaining}>
                  {remaining} more needed
                </span>
              )}
            </div>
          </div>

          {/* Info notice */}
          <div className={styles.infoNotice}>
            <span>ℹ️ Each flavor is mandatory (1 packet minimum). Add {userChoiceCount} more packets from your favorite flavors!</span>
          </div>

          {/* Unavailable notice */}
          {unavailableCount > 0 && (
            <div className={styles.notice}>
              <FiAlertCircle />
              <span>{unavailableCount} flavor{unavailableCount > 1 ? 's are' : ' is'} currently unavailable</span>
            </div>
          )}

          {/* Flavor selection */}
          <div className={styles.flavors}>
            {availableOnly.map((flavor) => {
              const count = selections[flavor.id] || 0;
              const isSelected = count > 0;

              return (
                <div
                  key={flavor.id}
                  className={`${styles.flavorCard} ${isSelected ? styles.selected : ''}`}
                >
                  <div className={styles.flavorInfo}>
                    <h3>{flavor.name}</h3>
                    <p className={styles.stock}>
                      {flavor.stock} packets available
                    </p>
                  </div>

                  <div className={styles.controls}>
                    <button
                      className={styles.controlBtn}
                      onClick={() => handleDecrement(flavor.id)}
                      disabled={count <= 1}
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <span className={styles.count}>{count}</span>
                    <button
                      className={styles.controlBtn}
                      onClick={() => handleIncrement(flavor.id)}
                      disabled={totalSelected >= 6 || count >= flavor.stock}
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>

                  {isSelected && (
                    <div className={styles.checkmark}>
                      <FiCheck />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Validation message */}
          {!isValid && totalSelected > 0 && (
            <div className={styles.validation}>
              {totalSelected !== 6 && (
                <p>⚠️ Please select exactly 6 packets ({remaining} {remaining === 1 ? 'packet' : 'packets'} {remaining > 0 ? 'more needed' : 'too many'})</p>
              )}
              {totalSelected === 6 && !allMandatorySelected && (
                <p>⚠️ All {mandatoryCount} flavors are mandatory (at least 1 packet each)</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className={styles.actions}>
            <button
              className={styles.cancelBtn}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className={`${styles.confirmBtn} ${isValid ? styles.valid : ''}`}
              onClick={handleConfirm}
              disabled={!isValid}
            >
              {isValid ? (
                <>
                  <FiCheck /> Confirm Selection
                </>
              ) : (
                'Select 6 Packets'
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
